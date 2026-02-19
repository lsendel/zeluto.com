export class Result<T, E = string> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly errorValue: E;
  private readonly successValue: T;

  private constructor(isSuccess: boolean, error?: E, value?: T) {
    if (isSuccess && error) {
      throw new Error('InvalidOperation: a result cannot be successful and contain an error');
    }
    if (!isSuccess && !error) {
      throw new Error('InvalidOperation: a failing result needs to contain an error message');
    }

    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.errorValue = error!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.successValue = value!;

    Object.freeze(this);
  }

  public getValue(): T {
    if (!this.isSuccess) {
      throw new Error("Can't get the value of an error result. Use getError instead.");
    }
    return this.successValue;
  }

  public getError(): E {
    if (this.isSuccess) {
      throw new Error("Can't get the error of a success result. Use getValue instead.");
    }
    return this.errorValue;
  }

  public static ok<U>(value?: U): Result<U, never> {
    return new Result<U, never>(true, undefined, value as U);
  }

  public static fail<U, E>(error: E): Result<U, E> {
    return new Result<U, E>(false, error);
  }

  public static combine(results: Result<any, any>[]): Result<any> {
    for (const result of results) {
      if (result.isFailure) return result;
    }
    return Result.ok();
  }
}
