/**
 * Storage Controller
 * Handles file upload/delete HTTP requests
 */

import { Context } from "elysia";
import { UploadAvatarCommand } from "../../../application/use-cases/storage/upload-avatar.command";
import { DeleteAvatarCommand } from "../../../application/use-cases/storage/delete-avatar.command";
import { AuthContext } from "../middleware/auth.middleware";
import { logger } from "../../../logger";

export class StorageController {
  constructor(
    private readonly uploadAvatarCommand: UploadAvatarCommand,
    private readonly deleteAvatarCommand: DeleteAvatarCommand
  ) {}

  async uploadAvatar(context: Context & { auth: AuthContext }) {
    // Extract file from multipart form data
    const file = context.body.file as any;

    if (!file) {
      context.set.status = 400;
      return { error: "No file provided" };
    }

    // Convert file to buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    const result = await this.uploadAvatarCommand.execute({
      userId: context.auth.userId,
      file: fileBuffer,
      mimeType: file.type,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    return {
      url: result.value.file.url,
      size: result.value.file.size,
      mimeType: result.value.file.mimeType,
    };
  }

  async deleteAvatar(context: Context & { auth: AuthContext }) {
    const result = await this.deleteAvatarCommand.execute({
      userId: context.auth.userId,
    });

    if (!result.success) {
      context.set.status = this.getStatusCode(result.error);
      return { error: result.error.message, code: result.error.code };
    }

    return { message: "Avatar deleted successfully" };
  }

  private getStatusCode(error: any): number {
    const code = error.code || "INTERNAL_ERROR";
    
    switch (code) {
      case "UNAUTHORIZED":
        return 401;
      case "FORBIDDEN":
        return 403;
      case "NOT_FOUND":
        return 404;
      case "VALIDATION_ERROR":
      case "INVALID_FILE_TYPE":
      case "FILE_TOO_LARGE":
        return 400;
      default:
        return 500;
    }
  }
}
