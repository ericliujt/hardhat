# Ledger Documentation Feedback

Overall the Ledger Developer Portal provides a solid foundation for developers working with Ledger devices, but there are several areas where the documentation could be improved to enhance developer experience. We highglighted 3 areas that could provide the most positive impact to devx.

---

## 1. Ethereum Signer Kit

- **Incomplete parameter/return details**: Methods like `signTransaction`, `signTypedData` lack precise type and format documentation for it parameters.
- **No error handling guidance**: Missing error codes, common failure cases (e.g., user cancel, invalid derivation path).
- **Limited examples**: Basic flows only; no advanced integrations

**Example error handling improvement**

```typescript
import { executeDeviceAction } from "@ledgerhq/device-management-kit";

try {
  const response = await executeDeviceAction(device, async (transport) => {
    return transport.send(0xe0, 0x01, 0x00, 0x00); // example APDU
  });
  console.log("APDU Response:", response);
} catch (error) {
  if (error instanceof DeviceLockedError) {
    console.error("Device is locked. Please unlock and retry.");
  } else if (error instanceof UserCancelledError) {
    console.error("User rejected the action on device.");
  } else {
    console.error("Unexpected error:", error);
  }
}
```

### Identification of Unclear or Missing Information

**Origin Token Requirements**

- **Issue**: The documentation mentions `originToken` is required but doesn't explain how to obtain it
- **Missing**: Application process, token validation, and usage guidelines
- **Impact**: Developers cannot complete basic setup

---

## 2. Legacy vs. Modern SDKs

- **LedgerJS tutorials still featured**: Marked as deprecated but not consistently flagged.
- **No migration guides**: No clear step-by-step transition from `ledger-js` to DMK/Signer Kits.
- **Example improvement: Version-Specific Documentation**
  - Clear version badges on all code examples
  - Deprecation warnings for outdated methods
  - Side-by-side version comparison tools

**Example migration guide**

```typescript
// OLD ledger-js (deprecated)
import TransportNodeHid from "@ledgerhq/hw-transport-node-hid";
import Eth from "@ledgerhq/hw-app-eth";

const transport = await TransportNodeHid.create();
const eth = new Eth(transport);
const address = await eth.getAddress("44'/60'/0'/0/0");

// NEW DMK + Ethereum Signer
import { getFirstConnectedDevice } from "@ledgerhq/device-management-kit";
import { EthSigner } from "@ledgerhq/device-signers-eth";

const device = await getFirstConnectedDevice();
const signer = new EthSigner(device);
const account = await signer.getAddress("44'/60'/0'/0/0");

console.log("Migrated Address:", account.address);
```

Legacy libraries are not kept on developer portal, however developers still might want to refer to these libraries so it might be good to keep legacy libraries in the documentation website.

---

## 3. Missing TypeScript Type Definitions & Documentation

- **Issue**: No TypeScript definitions for DMK, requiring `as any` throughout code
- **Missing**: Proper @types packages or built-in TypeScript support
- **Documentation**: TS Doc pages (`Device Management Kit`, `Device Signer Kit Ethereum`) are completely empty
- **Impact**: Loss of type safety, IntelliSense, and increased development friction

**Current workaround required:**

```typescript
// All DMK imports require 'as any' casting
const dmkModule = (await import("@ledgerhq/device-management-kit")) as any;
const { DeviceManagementKitBuilder } = dmkModule;

// SignerEthBuilder requires type casting
this.signer = new SignerEthBuilder({
  dmk: this.dmk,
  sessionId: this.sessionId,
  originToken: "dev-token",
} as any).build();
```

---

## 4. purify-ts Dependency Not Documented

- **Issue**: DMK requires purify-ts Either monad but this isn't mentioned in documentation
- **Missing**: Clear dependency requirements and usage patterns
- **Impact**: Runtime errors when transport methods don't return Either.Right/Left

**Should be documented:**

```typescript
import { Right, Left } from "purify-ts";

// All transport methods must return Either types
connect: async (deviceId: string) => {
  try {
    // ... connection logic
    return Right(connectionObject); // Success
  } catch (error) {
    return Left(error); // Failure
  }
};
```

---

## 5. Observable Pattern Documentation Lacking

- **Issue**: All signer methods return observables but usage patterns aren't documented
- **Missing**: Examples of how to properly consume observable responses
- **Impact**: Developers unfamiliar with RxJS struggle to use the API

**Needed documentation:**

```typescript
import { firstValueFrom, filter } from "rxjs";
import { DeviceActionStatus } from "@ledgerhq/device-management-kit";

// Must filter for completion status
const { observable } = signer.getAddress(derivationPath);
const result = await firstValueFrom(
  observable.pipe(
    filter(
      (state) =>
        state.status === DeviceActionStatus.Completed ||
        state.status === DeviceActionStatus.Error,
    ),
  ),
);
```

---

## 6. Device Model Detection Issues

- **Issue**: No clear way to detect device model from TransportNodeHid events
- **Missing**: Documentation on device identification and model detection
- **Current hacky workaround:**

```typescript
deviceModel: {
  id: event.device?.productName?.includes("Flex") ? "flex" : "nanoS",
  model: event.device?.productName || "Ledger Device"
}
```

## 7. Transport Adapter Complexity

- **Issue**: Creating a transport adapter for Node.js requires extensive undocumented boilerplate
- **Missing**: Clear interface specification for custom transport implementations
- **Impact**: ~150 lines of complex wrapper code needed for basic Node HID integration

**Example of required transport wrapper complexity:**

```typescript
// Required wrapper for TransportNodeHid to work with DMK
const nodeHidTransportFactory = () => {
  const transport = {
    getIdentifier: () => "node-hid",
    id: "node-hid",
    create: async () => {
      /* implementation */
    },
    listen: (observer: any) => {
      /* implementation */
    },
    isSupported: () => Promise.resolve(true),
    connect: async (deviceId: string) => {
      // Must return Either.Right with specific structure
      // Must implement sendApdu with APDU format conversion
      // Must handle response format transformation
    },
    // ... many more required methods
  };
};
```

---

## 8. APDU Response Format Not Documented

- **Issue**: DMK expects APDU responses as `{data: Uint8Array, statusCode: Uint8Array}` but this isn't documented
- **Missing**: Clear specification of expected APDU response structure
- **Impact**: Runtime errors that are difficult to debug

**What the documentation should show:**

```typescript
// DMK expects this format (NOT documented)
sendApdu: async (apdu: Uint8Array) => {
  const response = await transport.exchange(apdu);
  // Must split response into data and status code
  return Right({
    data: response.slice(0, -2), // All bytes except last 2
    statusCode: response.slice(-2), // Last 2 bytes (SW1 SW2)
  });
};
```
