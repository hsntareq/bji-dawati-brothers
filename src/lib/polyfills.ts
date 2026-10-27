// Polyfills for legacy browsers (Android 7-10, iOS 12-15, older Chrome/Safari/Edge)
if (typeof window !== "undefined") {
  // 1. globalThis polyfill
  if (typeof (window as any).globalThis === "undefined") {
    (window as any).globalThis = window;
  }

  // 2. Object.hasOwn polyfill (added in Chrome 93, Safari 15.4)
  if (typeof (Object as any).hasOwn !== "function") {
    (Object as any).hasOwn = function (obj: any, prop: PropertyKey): boolean {
      if (obj === null || obj === undefined) return false;
      return Object.prototype.hasOwnProperty.call(obj, prop);
    };
  }

  // 3. Array.prototype.at polyfill (added in Chrome 92, Safari 15.4)
  if (!Array.prototype.at) {
    Array.prototype.at = function (n: number) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
  }

  // 4. String.prototype.replaceAll polyfill (added in Chrome 85, Safari 13.1)
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (searchValue: any, replaceValue: any) {
      if (searchValue instanceof RegExp) {
        if (!searchValue.global) {
          throw new TypeError("replaceAll called with non-global RegExp");
        }
        return this.replace(searchValue, replaceValue);
      }
      return this.split(searchValue).join(replaceValue);
    };
  }

  // 5. Promise.allSettled polyfill (added in Chrome 76, Safari 13)
  if (!Promise.allSettled) {
    (Promise as any).allSettled = function (promises: Iterable<any>) {
      return Promise.all(
        Array.from(promises).map((p) =>
          Promise.resolve(p).then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason })
          )
        )
      );
    };
  }

  // 6. structuredClone fallback (added in Chrome 98, Safari 15.4)
  if (typeof (window as any).structuredClone === "undefined") {
    (window as any).structuredClone = function (obj: any) {
      if (obj === undefined) return undefined;
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch {
        return obj;
      }
    };
  }

  // 7. crypto.randomUUID fallback (requires secure origin & Chrome 92+, Safari 15.4+)
  if (typeof window.crypto === "undefined") {
    (window as any).crypto = {};
  }
  if (typeof window.crypto.randomUUID === "undefined") {
    window.crypto.randomUUID = function () {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }) as any;
    };
  }

  // 8. requestIdleCallback fallback
  if (typeof (window as any).requestIdleCallback === "undefined") {
    (window as any).requestIdleCallback = function (cb: any) {
      const start = Date.now();
      return setTimeout(function () {
        cb({
          didTimeout: false,
          timeRemaining: function () {
            return Math.max(0, 50 - (Date.now() - start));
          },
        });
      }, 1);
    };
    (window as any).cancelIdleCallback = function (id: any) {
      clearTimeout(id);
    };
  }
}

export {};
