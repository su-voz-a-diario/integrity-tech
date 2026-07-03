import { ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';

export function MaxJsonSize(maxBytes: number, validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      constraints: [maxBytes],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          try {
            return Buffer.byteLength(JSON.stringify(value ?? null), 'utf8') <= maxBytes;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} excede el tamaño máximo permitido de ${maxBytes} bytes.`;
        },
      },
    });
  };
}
