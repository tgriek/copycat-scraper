import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp: ts }) => {
  return `${ts} [${level}]: ${message}`;
});

export function createLogger(verbose: boolean): winston.Logger {
  return winston.createLogger({
    level: verbose ? 'debug' : 'info',
    format: combine(
      timestamp({ format: 'HH:mm:ss' }),
      colorize(),
      logFormat,
    ),
    transports: [
      new winston.transports.Console(),
    ],
  });
}

export function createLoggerWithTransports(
  verbose: boolean,
  extraTransports: winston.transport[],
): winston.Logger {
  return winston.createLogger({
    level: verbose ? 'debug' : 'info',
    format: combine(
      timestamp({ format: 'HH:mm:ss' }),
      logFormat,
    ),
    transports: [
      new winston.transports.Console({
        format: combine(colorize(), logFormat),
      }),
      ...extraTransports,
    ],
  });
}

export const logger = createLogger(false);
