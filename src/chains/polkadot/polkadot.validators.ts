import {
  mkRequestValidator,
  mkValidator,
  RequestValidator,
  Validator,
} from '../../services/validators';

const invalidAddressError: string = 'The provided Polkadot address is invalid.';
const invalidAmountError: string = 'The amount must be a positive number.';
const invalidFromAddressError: string = 'The from address is invalid.';
const invalidToAddressError: string = 'The to address is invalid.';


const validatePolkadotAddress = mkValidator(
  'address',
  invalidAddressError,
  (val) => typeof val === 'string' && val.length === 48
);

const validatePositiveAmount = mkValidator(
  'amount',
  invalidAmountError,
  (val) => typeof val === 'number' && val > 0
);

const validateFromAddress = mkValidator(
  'from',
  invalidFromAddressError,
  (val) => typeof val === 'string' && val.length === 48
);

const validateToAddress = mkValidator(
  'to',
  invalidToAddressError,
  (val) => typeof val === 'string' && val.length === 48
);

export const invalidNetworkError: string = 'The network param is not a string.';
export const validateNetwork: Validator = mkValidator(
  'network',
  invalidNetworkError,
  (val) => typeof val === 'string'
);
export const validatePolkadotBalanceRequest: RequestValidator = mkRequestValidator([
  validatePolkadotAddress,
  validateNetwork
]);

export const validateEstimateGasRequest: RequestValidator = mkRequestValidator([
  validateFromAddress,
  validateToAddress,
  validatePositiveAmount,
]);
