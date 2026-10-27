/* eslint-env jest */
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: '/data/user/0/com.secureshare.app/files/',
  cacheDirectory: '/data/user/0/com.secureshare.app/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024 }),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

jest.mock('expo-keep-awake', () => ({
  useKeepAwake: jest.fn(),
  activateKeepAwakeAsync: jest.fn().mockResolvedValue(undefined),
  deactivateKeepAwake: jest.fn(),
}));

jest.mock('react-native-tcp-socket', () => ({
  createServer: jest.fn().mockReturnValue({
    listen: jest.fn(),
    close: jest.fn(),
    on: jest.fn(),
  }),
  createConnection: jest.fn().mockReturnValue({
    write: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
  }),
}));

jest.mock('react-native-zeroconf', () => {
  return jest.fn().mockImplementation(() => ({
    publishService: jest.fn(),
    unpublishService: jest.fn(),
    scan: jest.fn(),
    stop: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  }));
});

jest.mock('react-native-libsodium', () => ({
  ready: Promise.resolve(),
  crypto_kx_keypair: jest.fn().mockReturnValue({
    publicKey: new Uint8Array(32),
    privateKey: new Uint8Array(32),
  }),
  crypto_kx_client_session_keys: jest.fn().mockReturnValue({
    sharedRx: new Uint8Array(32),
    sharedTx: new Uint8Array(32),
  }),
  crypto_kx_server_session_keys: jest.fn().mockReturnValue({
    sharedRx: new Uint8Array(32),
    sharedTx: new Uint8Array(32),
  }),
  crypto_secretstream_xchacha20poly1305_init_push: jest.fn().mockReturnValue({
    state: {},
    header: new Uint8Array(24),
  }),
  crypto_secretstream_xchacha20poly1305_init_pull: jest.fn().mockReturnValue({}),
  crypto_secretstream_xchacha20poly1305_push: jest.fn().mockReturnValue(new Uint8Array(32)),
  crypto_secretstream_xchacha20poly1305_pull: jest.fn().mockReturnValue({
    message: new Uint8Array(16),
    tag: 0,
  }),
  crypto_generichash: jest.fn().mockReturnValue(new Uint8Array(32)),
  crypto_secretstream_xchacha20poly1305_TAG_FINAL: 3,
  crypto_secretstream_xchacha20poly1305_TAG_MESSAGE: 0,
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('notif-id'),
  dismissNotificationAsync: jest.fn().mockResolvedValue(undefined),
  AndroidImportance: { HIGH: 4, LOW: 2 },
}));

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn().mockReturnValue([{ granted: true }, jest.fn()]),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: props => React.createElement('Svg', props),
    Circle: props => React.createElement('Circle', props),
    Rect: props => React.createElement('Rect', props),
    Path: props => React.createElement('Path', props),
  };
});

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true }),
}));

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn().mockReturnValue({}),
  EventEmitter: class {
    addListener = jest.fn();
    removeListener = jest.fn();
  },
  NativeModulesProxy: {},
  Platform: { OS: 'android' },
}));

jest.mock('react-native-wifi-p2p', () => ({
  initialize: jest.fn().mockResolvedValue(true),
  startDiscoveringPeers: jest.fn().mockResolvedValue(undefined),
  stopDiscoveringPeers: jest.fn().mockResolvedValue(undefined),
  subscribeOnPeersUpdates: jest.fn().mockReturnValue({ remove: jest.fn() }),
  subscribeOnConnectionInfoUpdates: jest.fn().mockReturnValue({ remove: jest.fn() }),
  connect: jest.fn().mockResolvedValue(undefined),
  connectWithConfig: jest.fn().mockResolvedValue(undefined),
  cancelConnect: jest.fn().mockResolvedValue(undefined),
  createGroup: jest.fn().mockResolvedValue(true),
  removeGroup: jest.fn().mockResolvedValue(undefined),
  getConnectionInfo: jest.fn().mockResolvedValue({
    groupFormed: false,
    groupOwnerAddress: { hostAddress: '' },
  }),
}));
