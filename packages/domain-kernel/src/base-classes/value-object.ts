export abstract class ValueObject<TProps> {
  protected readonly props: TProps;

  constructor(props: TProps) {
    this.props = Object.freeze({ ...props });
  }

  public equals(vo?: ValueObject<TProps>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    if ((vo as ValueObject<TProps>).props === undefined) {
      return false;
    }
    return (
      JSON.stringify(this.props) ===
      JSON.stringify((vo as ValueObject<TProps>).props)
    );
  }
}
