import * as path from 'node:path';
import * as fs from 'node:fs';

export interface ProjectNameValidationResult {
  valid: boolean;
  error?: string;
}

export interface TargetDirectoryValidationResult {
  valid: boolean;
  resolvedPath: string;
  exists: boolean;
  isEmpty: boolean;
  error?: string;
}

const RESERVED_NAMES = new Set([
  'node_modules',
  'favicon.ico',
  'package.json',
  'package-lock.json',
  'dist',
  'build',
  'public',
  'src',
]);

export function validateProjectName(name: string): ProjectNameValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Project name must be a non-empty string.' };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Project name cannot be empty or whitespace.' };
  }

  if (trimmed.length > 214) {
    return { valid: false, error: 'Project name is too long (maximum 214 characters).' };
  }

  if (trimmed.startsWith('.') || trimmed.startsWith('_')) {
    return { valid: false, error: 'Project name cannot start with a dot or underscore.' };
  }

  if (RESERVED_NAMES.has(trimmed.toLowerCase())) {
    return { valid: false, error: `'${trimmed}' is a reserved name and cannot be used as a project name.` };
  }

  // Reject path separators or dangerous characters
  if (/[/\\?%*:|"<>#]/.test(trimmed)) {
    return {
      valid: false,
      error: 'Project name contains invalid characters. Use alphanumeric characters, hyphens, and underscores.',
    };
  }

  // Recommended npm package name format
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Project name can only contain letters, numbers, hyphens, and underscores.',
    };
  }

  return { valid: true };
}

export function validateTargetDirectory(
  targetDir: string,
  cwd: string = process.cwd()
): TargetDirectoryValidationResult {
  const resolvedPath = path.isAbsolute(targetDir)
    ? path.resolve(targetDir)
    : path.resolve(cwd, targetDir);

  // Safety check: protect root or system directories
  const parsed = path.parse(resolvedPath);
  if (resolvedPath === parsed.root) {
    return {
      valid: false,
      resolvedPath,
      exists: true,
      isEmpty: false,
      error: 'Target directory cannot be the filesystem root.',
    };
  }

  let exists = false;
  let isEmpty = true;

  try {
    const stat = fs.statSync(resolvedPath);
    exists = true;

    if (!stat.isDirectory()) {
      return {
        valid: false,
        resolvedPath,
        exists: true,
        isEmpty: false,
        error: `Target path '${resolvedPath}' exists and is not a directory.`,
      };
    }

    const files = fs.readdirSync(resolvedPath);
    isEmpty = files.length === 0;

    if (!isEmpty) {
      return {
        valid: false,
        resolvedPath,
        exists: true,
        isEmpty: false,
        error: `Target directory '${resolvedPath}' is not empty (${files.length} items found). Scaffolding aborted to prevent overwriting existing files.`,
      };
    }
  } catch (err: unknown) {
    // If ENOENT, directory does not exist, which is ideal for a new project
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      exists = false;
      isEmpty = true;
    } else {
      return {
        valid: false,
        resolvedPath,
        exists: false,
        isEmpty: false,
        error: `Unable to access target directory '${resolvedPath}': ${(err as Error).message}`,
      };
    }
  }

  return {
    valid: true,
    resolvedPath,
    exists,
    isEmpty,
  };
}
