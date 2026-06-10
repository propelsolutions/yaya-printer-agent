export class PartialPrintError extends Error {
  copiesPrinted: number;
  copiesRequested: number;

  constructor(message: string, copiesPrinted: number, copiesRequested: number) {
    super(message);
    this.name = "PartialPrintError";
    this.copiesPrinted = copiesPrinted;
    this.copiesRequested = copiesRequested;
  }
}
