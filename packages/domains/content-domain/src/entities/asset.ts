import { z } from 'zod';

export const AssetPropsSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number(),
  r2Key: z.string().min(1),
  downloadUrl: z.string().nullable(),
  downloadCount: z.number(),
  folder: z.string().nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.coerce.date(),
});

export type AssetProps = z.infer<typeof AssetPropsSchema>;

export class Asset {
  private constructor(private props: AssetProps) {}

  // ---- Factory methods ----

  static create(input: {
    organizationId: string;
    name: string;
    fileName: string;
    mimeType: string;
    size: number;
    r2Key: string;
    folder?: string | null;
    createdBy: string;
  }): Asset {
    return new Asset(
      AssetPropsSchema.parse({
        id: crypto.randomUUID(),
        organizationId: input.organizationId,
        name: input.name,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        r2Key: input.r2Key,
        downloadUrl: null,
        downloadCount: 0,
        folder: input.folder ?? null,
        createdBy: input.createdBy,
        createdAt: new Date(),
      }),
    );
  }

  static reconstitute(props: AssetProps): Asset {
    return new Asset(AssetPropsSchema.parse(props));
  }

  // ---- Accessors ----

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get fileName(): string {
    return this.props.fileName;
  }
  get mimeType(): string {
    return this.props.mimeType;
  }
  get size(): number {
    return this.props.size;
  }
  get r2Key(): string {
    return this.props.r2Key;
  }
  get downloadUrl(): string | null {
    return this.props.downloadUrl;
  }
  get downloadCount(): number {
    return this.props.downloadCount;
  }
  get folder(): string | null {
    return this.props.folder;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  // ---- Domain methods ----

  recordDownload(): void {
    this.props.downloadCount += 1;
  }

  /** Return a plain object suitable for persistence. */
  toProps(): Readonly<AssetProps> {
    return Object.freeze({ ...this.props });
  }
}
