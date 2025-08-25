import {
  mkRequestValidator,
  mkValidator,
  RequestValidator,
  validateTxHash,
  Validator,
} from '../../services/validators';

const invalidAddressError: string = 'The provided Hydration address is invalid.';
// const invalidAmountError: string = 'The amount must be a positive number.';
const invalidAssetSymbolError: string = 'The asset symbol is invalid.';
const invalidNetworkError: string = 'The network param is not a string.';

const validateHydrationAddress = mkValidator(
  'address',
  invalidAddressError,
  (val) => typeof val === 'string' && val.length === 48
);

// const validatePositiveAmount = mkValidator(
//   'amount',
//   invalidAmountError,
//   (val) => typeof val === 'number' && val > 0
// );

const validateAssetSymbol = mkValidator(
  'tokenSymbol',
  invalidAssetSymbolError,
  (val) => typeof val === 'string' && /^[A-Z0-9]+$/.test(val)
);

export const validateHydrationNetwork: Validator = mkValidator(
  'network',
  invalidNetworkError,
  (val) => typeof val === 'string'
);

export const validateHydrationPollRequest: RequestValidator = mkRequestValidator(
  [validateHydrationNetwork, validateTxHash]
);

export const validateHydrationBalanceRequest: RequestValidator = mkRequestValidator([
  validateHydrationAddress,
  validateNetwork
]);

export const validateHydrationAssetsRequest: RequestValidator = mkRequestValidator([
  validateNetwork,
  validateAssetSymbol
]);

export const validateHydrationOptInRequest: RequestValidator = mkRequestValidator([
  validateHydrationAddress,
  validateAssetSymbol,
  validateNetwork
]);
