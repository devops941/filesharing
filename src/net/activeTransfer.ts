let _cancelHandler: (() => void) | null = null;

export function registerTransferCancel(fn: (() => void) | null): void {
  _cancelHandler = fn;
}

export function cancelActiveTransfer(): void {
  if (_cancelHandler) {
    const fn = _cancelHandler;
    _cancelHandler = null;
    try {
      fn();
    } catch {}
  }
}
