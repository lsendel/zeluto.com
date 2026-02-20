export abstract class Entity<TProps> {
  protected readonly props: TProps;

  constructor(
    readonly id: string,
    props: TProps,
  ) {
    this.props = props;
  }

  public equals(object?: Entity<TProps>): boolean {
    if (object == null || object === undefined) {
      return false;
    }

    if (this === object) {
      return true;
    }

    if (!isEntity(object)) {
      return false;
    }

    return this.id === object.id;
  }

  /**
   * Returns a copy of the internal properties.
   * Useful for serialization/persistence.
   */
  public getProps(): TProps {
    return { ...this.props };
  }
}

const isEntity = (v: any): v is Entity<any> => {
  return v instanceof Entity;
};
