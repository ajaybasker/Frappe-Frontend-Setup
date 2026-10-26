import * as fs from 'node:fs';

export interface HooksUpdateResult {
  modified: boolean;
  content: string;
  backupPath?: string;
  description: string;
  diff?: string;
}

/**
 * Safely updates hooks.py to add website_route_rules for SPA client-side routing.
 * Preserves all existing comments, formatting, and hooks. Never replaces wholesale.
 */
export function updateHooksFile(
  hooksPath: string,
  route: string,
  dryRun: boolean = false
): HooksUpdateResult {
  if (!fs.existsSync(hooksPath)) {
    throw new Error(`hooks.py file not found at '${hooksPath}'.`);
  }

  const originalContent = fs.readFileSync(hooksPath, 'utf8');

  // Check if route is already registered
  const routePattern = new RegExp(`["']\\/${route}\\/<path:app_path>["']`, 'i');
  if (routePattern.test(originalContent) || originalContent.includes(`"to_route": "${route}"`) || originalContent.includes(`'to_route': '${route}'`)) {
    return {
      modified: false,
      content: originalContent,
      description: `hooks.py already contains website_route_rules for route '/${route}'.`,
    };
  }

  const newRuleLine = `    {"from_route": "/${route}/<path:app_path>", "to_route": "${route}"},`;

  let modifiedContent = originalContent;

  // Check if website_route_rules already exists in the file
  const routeRulesRegex = /website_route_rules\s*=\s*\[([\s\S]*?)\]/m;
  const match = originalContent.match(routeRulesRegex);

  if (match) {
    // Append the rule inside the existing list before the closing bracket
    const fullMatch = match[0];
    const innerContent = match[1];

    let replacement: string;
    if (innerContent.trim() === '') {
      replacement = `website_route_rules = [\n${newRuleLine}\n]`;
    } else {
      const trimmedInner = innerContent.trimEnd();
      const hasTrailingComma = trimmedInner.endsWith(',');
      replacement = `website_route_rules = [${trimmedInner}${hasTrailingComma ? '' : ','}\n${newRuleLine}\n]`;
    }

    modifiedContent = originalContent.replace(fullMatch, replacement);
  } else {
    // Append clean website_route_rules block at the end of hooks.py
    const block =
      `\n\n# Frontend SPA routing configuration (configured by frappe-frontend-cli)\n` +
      `website_route_rules = [\n` +
      `${newRuleLine}\n` +
      `]\n`;

    modifiedContent = originalContent.trimEnd() + block;
  }

  let backupPath: string | undefined;

  if (!dryRun) {
    const timestamp = Date.now();
    backupPath = `${hooksPath}.bak.${timestamp}`;
    fs.writeFileSync(backupPath, originalContent, 'utf8');
    fs.writeFileSync(hooksPath, modifiedContent, 'utf8');
  }

  return {
    modified: true,
    content: modifiedContent,
    backupPath,
    description: `Added website_route_rules for '/${route}' in hooks.py`,
  };
}
