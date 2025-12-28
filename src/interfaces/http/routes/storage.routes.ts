/**
 * Storage Routes
 * POST /storage/upload
 */

import { Elysia, t } from "elysia";
import type { DomainError } from "../../../core";
import type { AuthContext } from "../middleware/auth";

// ============================================
// Types for Dependencies
// ============================================

export interface StorageRouteDeps {
  uploadAvatar: (input: any) => Promise<any>;
  deleteAvatar: (input: any) => Promise<any>;
}

// ============================================
// Error Response Helper
// ============================================

const errorResponse = (error: DomainError, status: number = 400) => ({
  status,
  body: {
    error: {
      code: error.code,
      message: error.message,
      metadata: error.metadata,
    },
  },
});

// ============================================
// Storage Routes
// ============================================

export const createStorageRoutes = (deps: StorageRouteDeps) => {
  return new Elysia({ prefix: "/storage" })
    // POST /storage/upload - Upload avatar
    .post("/upload", async ({ body, auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }

      const file = body.file;
      
      if (!file) {
        return errorResponse({ code: "VALIDATION_ERROR", message: "File is required" });
      }

      // Convert file to buffer
      const buffer = await file.arrayBuffer();

      const result = await deps.uploadAvatar({
        userId: auth.userId,
        data: new Uint8Array(buffer),
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });

      if (result.isErr()) {
        return errorResponse(result.error);
      }

      return result.value;
    }, {
      body: t.Object({
        file: t.File({
          maxSize: "5m",
        }),
      }),
    })
    
    // DELETE /storage/avatar - Delete avatar
    .delete("/avatar", async ({ auth }) => {
      if (!auth) {
        return errorResponse({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
      }

      const result = await deps.deleteAvatar({
        userId: auth.userId,
      });

      if (result.isErr()) {
        return errorResponse(result.error);
      }

      return result.value;
    });
};
