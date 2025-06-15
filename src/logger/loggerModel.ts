/**
 * HTTP header constants used for logging
 */
export enum HTTPHeaders {
  ResponseTime = 'x-response-time',
  ForwardedFor = 'x-forwarded-for',
}

/**
 * HTTP methods enumeration
 */
export enum HTTPMethods {
  HEAD = 'HEAD',
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

/**
 * Keys that should be redacted in logs for security
 */
export enum SensitiveKeys {
  Password = 'password',
  NewPassword = 'new_password',
  OldPassword = 'old_password',
  RepeatPassword = 'repeat_password',
  Token = 'token',
  ApiKey = 'api_key',
  Secret = 'secret',
}

/**
 * Log indentation levels for formatting
 */
export enum LogIndentation {
  None = 0,
  SM = 2, // Small
  MD = 4, // Medium
  LG = 6, // Large
  XL = 8, // XLarge
  XXL = 10,
  XXXL = 12,
}

/**
 * Standard success messages for different HTTP operations
 */
export enum SuccessMessages {
  CreateSuccess = 'POST method executed successfully',
  GetSuccess = 'GET method executed successfully',
  UpdateSuccess = 'PUT/PATCH method executed successfully',
  DeleteSuccess = 'DELETE method executed successfully',
  GenericSuccess = 'Operation completed successfully',
}

/**
 * Special formatting messages used in logs
 */
export enum SpecialMessages {
  Redacted = '*****',
  DottedLine = '. . . . . . .',
}

/**
 * Informational messages
 */
export enum InfoMessages {
  DatabasesConnected = 'Databases connected successfully!',
  ServerStarted = 'Server started and listening',
  InitComplete = 'Initialization completed successfully',
}

/**
 * Standard error message templates
 */
export enum ErrorMessages {
  AppStartupFail = 'Unable to start the app',
  MoviesChangeFail = 'Unexpected error while updating movies',
  MovieChangeFail = 'Unexpected error while checking for movie changes',
  ShowsChangeFail = 'Unexpected error while updating shows',
  ShowChangeFail = 'Unexpected error while checking for show changes',
  SeasonChangeFail = 'Unexpected error while checking for season changes',
  DatabaseConnectionFail = 'Unable to connect to database',
  AuthenticationFail = 'Authentication failure',
  ValidationFail = 'Validation failure',
}
