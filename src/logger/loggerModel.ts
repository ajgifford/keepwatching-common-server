export default interface HTTPLoggerResponseData {
  request: HTTPLoggerRequest;
  response: HTTPLoggerResponse;
}

interface HTTPLoggerRequest {
  headers: any;
  host?: string;
  baseUrl: string;
  url: string;
  method: string;
  body: any;
  params: any;
  query: any;
  clientIp?: string | string[];
}

interface HTTPLoggerResponse {
  headers: any;
  statusCode: number;
  requestDuration: string;
  body: any;
}

export enum HTTPHeaders {
  ResponseTime = 'x-response-time',
  ForwardedFor = 'x-forwarded-for',
}

export enum HTTPMethods {
  HEAD = 'HEAD',
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export enum SensitiveKeys {
  Password = 'password',
  NewPassword = 'new_password',
  OldPassword = 'old_password',
  RepeatPassword = 'repeat_password',
}

export enum LogIndentation {
  None = 0,
  SM = 2, // Small
  MD = 4, // Medium
  LG = 6, // Large
  XL = 8, // XLarge
  XXL = 10,
  XXXL = 12,
}

export enum SuccessMessages {
  CreateSuccess = 'POST method executed successfully',
  GetSuccess = 'GET method executed successfully',
  UpdateSuccess = 'PUT/PATCH method executed successfully',
  DeleteSuccess = 'DELETE method executed successfully',
  GenericSuccess = 'Operation completed successfully',
}

export enum SpecialMessages {
  Redacted = '*****',
  DottedLine = '. . . . . . .',
}

export enum InfoMessages {
  DatabasesConnected = 'Databases connected successfully!',
}

export enum ErrorMessages {
  AppStartupFail = 'Unable to start the app',
  MoviesChangeFail = 'Unexpected error while updating movies',
  MovieChangeFail = 'Unexpected error while checking for movie changes',
  ShowsChangeFail = 'Unexpected error while updating shows',
  ShowChangeFail = 'Unexpected error while checking for show changes',
  SeasonChangeFail = 'Unexpected error while checking for season changes',
}
