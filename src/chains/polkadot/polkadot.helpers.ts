/**
 *
 * @param value
 * @param errorMessage
 */
export const getNotNullOrThrowError = <R>(
    value?: any,
    errorMessage: string = 'Value is null or undefined'
): R => {
    if (value === undefined || value === null)
        throw new Error(errorMessage);

    return value as R;
};