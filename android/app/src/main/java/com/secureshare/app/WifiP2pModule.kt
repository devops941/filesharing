package com.secureshare.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.NetworkInfo
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.Looper
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class WifiP2pModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), WifiP2pManager.ChannelListener {

    override fun getName(): String = "WifiP2pModule"

    private var manager: WifiP2pManager? = null
    private var channel: WifiP2pManager.Channel? = null
    private var receiver: BroadcastReceiver? = null
    private var isReceiverRegistered = false

    init {
        initWifiP2p()
    }

    private fun initWifiP2p() {
        try {
            manager = reactContext.getSystemService(Context.WIFI_P2P_SERVICE) as? WifiP2pManager
            manager?.let { mgr ->
                channel = mgr.initialize(reactContext, Looper.getMainLooper(), this)
                registerReceiver()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onChannelDisconnected() {
        // BUG-6 FIX: Re-initialize channel AND re-register receiver.
        // The BroadcastReceiver holds a reference to P2P events; after channel
        // disconnect the old receiver may be stale, so fully re-initialize.
        unregisterReceiver()
        channel = manager?.initialize(reactContext, Looper.getMainLooper(), this)
        registerReceiver()
    }

    private fun registerReceiver() {
        if (isReceiverRegistered) return
        val intentFilter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }

        receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                when (intent?.action) {
                    WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                        val state = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1)
                        val isEnabled = state == WifiP2pManager.WIFI_P2P_STATE_ENABLED
                        val map = Arguments.createMap().apply {
                            putBoolean("isEnabled", isEnabled)
                        }
                        sendEvent("onWifiP2pStateChanged", map)
                    }
                    WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> {
                        requestPeers()
                    }
                    WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                        val networkInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO, NetworkInfo::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_NETWORK_INFO)
                        }
                        if (networkInfo?.isConnected == true) {
                            requestConnectionInfo()
                        } else {
                            val map = Arguments.createMap().apply {
                                putBoolean("isConnected", false)
                                putBoolean("isGroupOwner", false)
                                putString("groupOwnerAddress", "")
                            }
                            sendEvent("onConnectionChanged", map)
                        }
                    }
                    WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION -> {
                        val device = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_DEVICE, WifiP2pDevice::class.java)
                        } else {
                            @Suppress("DEPRECATION")
                            intent.getParcelableExtra(WifiP2pManager.EXTRA_WIFI_P2P_DEVICE)
                        }
                        device?.let {
                            val map = Arguments.createMap().apply {
                                putString("deviceName", it.deviceName ?: "")
                                putString("deviceAddress", it.deviceAddress ?: "")
                                putInt("status", it.status)
                            }
                            sendEvent("onThisDeviceChanged", map)
                        }
                    }
                }
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(receiver, intentFilter, Context.RECEIVER_EXPORTED)
            } else {
                reactContext.registerReceiver(receiver, intentFilter)
            }
            isReceiverRegistered = true
        } catch (e: Exception) {
            try {
                reactContext.registerReceiver(receiver, intentFilter)
                isReceiverRegistered = true
            } catch (e2: Exception) {
                e2.printStackTrace()
            }
        }
    }

    private fun unregisterReceiver() {
        if (isReceiverRegistered && receiver != null) {
            try {
                reactContext.unregisterReceiver(receiver)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            isReceiverRegistered = false
        }
    }

    override fun invalidate() {
        unregisterReceiver()
        super.invalidate()
    }

    private fun requestPeers() {
        val mgr = manager ?: return
        val ch = channel ?: return
        try {
            mgr.requestPeers(ch) { peers: WifiP2pDeviceList? ->
                val deviceList = Arguments.createArray()
                peers?.deviceList?.forEach { device ->
                    val map = Arguments.createMap().apply {
                        putString("deviceName", device.deviceName ?: "")
                        putString("deviceAddress", device.deviceAddress ?: "")
                        putString("primaryDeviceType", device.primaryDeviceType ?: "")
                        putInt("status", device.status)
                    }
                    deviceList.pushMap(map)
                }
                val result = Arguments.createMap().apply {
                    putArray("devices", deviceList)
                }
                sendEvent("onPeersChanged", result)
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun requestConnectionInfo() {
        val mgr = manager ?: return
        val ch = channel ?: return
        try {
            mgr.requestConnectionInfo(ch) { info: WifiP2pInfo? ->
                if (info != null) {
                    val map = Arguments.createMap().apply {
                        putBoolean("isConnected", info.groupFormed)
                        putBoolean("isGroupOwner", info.isGroupOwner)
                        putString("groupOwnerAddress", info.groupOwnerAddress?.hostAddress ?: "")
                    }
                    sendEvent("onConnectionChanged", map)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(eventName, params)
        } catch (e: Exception) {
            // Context might not be attached
        }
    }

    @ReactMethod
    fun isSupported(promise: Promise) {
        promise.resolve(manager != null)
    }

    @ReactMethod
    fun getLocalIP(promise: Promise) {
        try {
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            val ips = Arguments.createArray()
            if (interfaces != null) {
                while (interfaces.hasMoreElements()) {
                    val iface = interfaces.nextElement()
                    if (iface.isLoopback || !iface.isUp) continue
                    val addresses = iface.inetAddresses
                    while (addresses.hasMoreElements()) {
                        val addr = addresses.nextElement()
                        if (!addr.isLoopbackAddress && addr is java.net.Inet4Address) {
                            val host = addr.hostAddress
                            if (host != null && !host.startsWith("127.") && !host.startsWith("169.254.")) {
                                val map = Arguments.createMap().apply {
                                    putString("name", iface.name)
                                    putString("ip", host)
                                }
                                ips.pushMap(map)
                            }
                        }
                    }
                }
            }
            promise.resolve(ips)
        } catch (e: Exception) {
            promise.reject("ERR_IP", e.message)
        }
    }

    @ReactMethod
    fun discoverPeers(promise: Promise) {
        val mgr = manager ?: run {
            promise.reject("ERR_NOT_SUPPORTED", "Wi-Fi Direct not supported on this device")
            return
        }
        val ch = channel ?: run {
            promise.reject("ERR_NO_CHANNEL", "Wi-Fi Direct channel not initialized")
            return
        }

        try {
            mgr.discoverPeers(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }

                override fun onFailure(reason: Int) {
                    if (reason == WifiP2pManager.BUSY) {
                        // Already discovering or radio is busy — treat as active
                        promise.resolve(true)
                    } else {
                        promise.reject("ERR_DISCOVERY_FAILED", "Discover peers failed: $reason")
                    }
                }
            })
        } catch (e: SecurityException) {
            promise.reject("ERR_PERMISSION", "Missing location or nearby permission: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ERR_EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun getPeers(promise: Promise) {
        val mgr = manager ?: run {
            promise.resolve(Arguments.createArray())
            return
        }
        val ch = channel ?: run {
            promise.resolve(Arguments.createArray())
            return
        }
        try {
            mgr.requestPeers(ch) { peers: WifiP2pDeviceList? ->
                val deviceList = Arguments.createArray()
                peers?.deviceList?.forEach { device ->
                    val map = Arguments.createMap().apply {
                        putString("deviceName", device.deviceName ?: "")
                        putString("deviceAddress", device.deviceAddress ?: "")
                        putString("primaryDeviceType", device.primaryDeviceType ?: "")
                        putInt("status", device.status)
                    }
                    deviceList.pushMap(map)
                }
                promise.resolve(deviceList)
            }
        } catch (e: Exception) {
            promise.resolve(Arguments.createArray())
        }
    }

    @ReactMethod
    fun setDeviceName(name: String, promise: Promise) {
        val mgr = manager ?: run {
            promise.resolve(false)
            return
        }
        val ch = channel ?: run {
            promise.resolve(false)
            return
        }
        // BUG-15 FIX: Java reflection for setDeviceName is blocked on Android 10+ (API 29+)
        // via restricted non-SDK interface enforcement. On modern Android, this always fails.
        // The app uses mDNS device name (via Zeroconf) as the primary identifier anyway.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: reflection blocked — resolve false gracefully
            promise.resolve(false)
            return
        }
        try {
            val method = mgr.javaClass.getMethod(
                "setDeviceName",
                WifiP2pManager.Channel::class.java,
                String::class.java,
                WifiP2pManager.ActionListener::class.java
            )
            method.invoke(mgr, ch, name, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }
                override fun onFailure(reason: Int) {
                    promise.resolve(false)
                }
            })
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun stopPeerDiscovery(promise: Promise) {
        val mgr = manager ?: return
        val ch = channel ?: return
        try {
            mgr.stopPeerDiscovery(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }
                override fun onFailure(reason: Int) {
                    promise.resolve(false)
                }
            })
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun connect(deviceAddress: String, promise: Promise) {
        val mgr = manager ?: run {
            promise.reject("ERR_NOT_SUPPORTED", "Wi-Fi Direct not supported")
            return
        }
        val ch = channel ?: run {
            promise.reject("ERR_NO_CHANNEL", "Wi-Fi Direct channel not initialized")
            return
        }

        // Stop discovery before connect to prevent resource contention on OEM devices
        try {
            mgr.stopPeerDiscovery(ch, null)
        } catch (e: Exception) {
            // ignore
        }

        val config = WifiP2pConfig().apply {
            this.deviceAddress = deviceAddress
            // BUG-7 FIX: Use intent=1 (low preference, non-zero) so receiver's autonomous
            // group is preferred as GO. Intent=0 meant sender always tried to be client
            // but if receiver was also intent=0 (as discoverer, not GO), connection failed.
            this.groupOwnerIntent = 1
        }

        try {
            mgr.connect(ch, config, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }

                override fun onFailure(reason: Int) {
                    promise.reject("ERR_CONNECT_FAILED", "Failed to connect to Wi-Fi Direct peer: $reason")
                }
            })
        } catch (e: SecurityException) {
            promise.reject("ERR_PERMISSION", "Missing permission: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ERR_EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun cancelConnect(promise: Promise) {
        val mgr = manager ?: return
        val ch = channel ?: return
        try {
            mgr.cancelConnect(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }
                override fun onFailure(reason: Int) {
                    promise.resolve(false)
                }
            })
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun createGroup(promise: Promise) {
        val mgr = manager ?: run {
            promise.reject("ERR_NOT_SUPPORTED", "Wi-Fi Direct not supported")
            return
        }
        val ch = channel ?: run {
            promise.reject("ERR_NO_CHANNEL", "Wi-Fi Direct channel not initialized")
            return
        }

        // Ensure any existing stale group is removed first before creating a fresh group
        try {
            mgr.removeGroup(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    createNewGroup(mgr, ch, promise)
                }

                override fun onFailure(reason: Int) {
                    // Even if removeGroup fails (no group existed), proceed to create group
                    createNewGroup(mgr, ch, promise)
                }
            })
        } catch (e: Exception) {
            createNewGroup(mgr, ch, promise)
        }
    }

    private fun createNewGroup(mgr: WifiP2pManager, ch: WifiP2pManager.Channel, promise: Promise) {
        try {
            mgr.createGroup(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }

                override fun onFailure(reason: Int) {
                    promise.reject("ERR_CREATE_GROUP_FAILED", "Failed to create Wi-Fi Direct group: $reason")
                }
            })
        } catch (e: SecurityException) {
            promise.reject("ERR_PERMISSION", "Missing permission: ${e.message}")
        } catch (e: Exception) {
            promise.reject("ERR_EXCEPTION", e.message)
        }
    }

    @ReactMethod
    fun removeGroup(promise: Promise) {
        val mgr = manager ?: return
        val ch = channel ?: return
        try {
            mgr.removeGroup(ch, object : WifiP2pManager.ActionListener {
                override fun onSuccess() {
                    promise.resolve(true)
                }
                override fun onFailure(reason: Int) {
                    promise.resolve(false)
                }
            })
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getConnectionInfo(promise: Promise) {
        val mgr = manager ?: run {
            promise.reject("ERR_NOT_SUPPORTED", "Wi-Fi Direct not supported")
            return
        }
        val ch = channel ?: run {
            promise.reject("ERR_NO_CHANNEL", "Wi-Fi Direct channel not initialized")
            return
        }

        try {
            mgr.requestConnectionInfo(ch) { info: WifiP2pInfo? ->
                val map = Arguments.createMap()
                if (info != null) {
                    map.putBoolean("isConnected", info.groupFormed)
                    map.putBoolean("isGroupOwner", info.isGroupOwner)
                    map.putString("groupOwnerAddress", info.groupOwnerAddress?.hostAddress ?: "")
                } else {
                    map.putBoolean("isConnected", false)
                    map.putBoolean("isGroupOwner", false)
                    map.putString("groupOwnerAddress", "")
                }
                promise.resolve(map)
            }
        } catch (e: Exception) {
            promise.reject("ERR_GET_INFO", e.message)
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter
    }
}
