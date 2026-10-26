import * as path from 'node:path';
import * as fs from 'node:fs';

export interface DeskPageOptions {
  appDir: string;
  appName: string;
  pageName: string;
  title?: string;
  moduleName?: string;
  outputDir?: string;
  dryRun?: boolean;
}

export interface DeskPageGenerationResult {
  jsonCreated: boolean;
  jsonPath: string;
  jsonBackupPath?: string;
  jsCreated: boolean;
  jsPath: string;
  jsBackupPath?: string;
  pageDir: string;
}

/**
 * Detects the Frappe module name from modules.txt in the custom app.
 */
export function detectAppModule(appPkgDir: string, appName: string): string {
  const modulesTxt = path.join(appPkgDir, 'modules.txt');
  if (fs.existsSync(modulesTxt)) {
    try {
      const content = fs.readFileSync(modulesTxt, 'utf8');
      const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        return lines[0];
      }
    } catch {
      // fallback
    }
  }

  // Format module name from appName (e.g. 'custom_crm' -> 'Custom Crm')
  return appName
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Generates Frappe Desk Page files (<page_name>.json and <page_name>.js) in
 * <app_dir>/<app_name>/<module_slug>/page/<page_name>/.
 * Kept strictly separate from website www/ routes.
 */
export function generateDeskPage(options: DeskPageOptions): DeskPageGenerationResult {
  const {
    appDir,
    appName,
    pageName: rawPageName,
    title: rawTitle,
    outputDir = 'frontend',
    dryRun = false,
  } = options;

  const pageName = rawPageName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const title =
    rawTitle ||
    pageName
      .split(/[_-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const appPkgDir = path.join(appDir, appName);
  const moduleName = options.moduleName || detectAppModule(appPkgDir, appName);
  const moduleSlug = moduleName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  const pageDir = path.join(appPkgDir, moduleSlug, 'page', pageName);
  const jsonPath = path.join(pageDir, `${pageName}.json`);
  const jsPath = path.join(pageDir, `${pageName}.js`);

  const pageJsonContent = JSON.stringify(
    {
      creation: '2026-10-26 12:00:00.000000',
      docstatus: 0,
      doctype: 'Page',
      idx: 0,
      modified: '2026-10-26 12:00:00.000000',
      modified_by: 'Administrator',
      module: moduleName,
      name: pageName,
      owner: 'Administrator',
      page_name: pageName,
      roles: [],
      standard: 'Yes',
      system_page: 0,
      title: title,
    },
    null,
    1
  ) + '\n';

  const pageJsContent =
`// Frappe Desk Page controller for '${pageName}'
// Configured by frappe-frontend-cli
frappe.pages['${pageName}'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: '${title}',
		single_column: true
	});

	// Dedicated mount container for the frontend SPA
	var $container = $('<div id="${pageName}-app"></div>').appendTo(page.main);

	// Load production SPA bundle
	var assetBase = '/assets/${appName}/${outputDir}/';
	frappe.require(assetBase + 'index.js', function() {
		// Loaded production bundle
	});
};
`;

  let jsonCreated = false;
  let jsonBackupPath: string | undefined;
  let jsCreated = false;
  let jsBackupPath: string | undefined;

  if (!dryRun) {
    if (!fs.existsSync(pageDir)) {
      fs.mkdirSync(pageDir, { recursive: true });
    }

    if (fs.existsSync(jsonPath)) {
      const existing = fs.readFileSync(jsonPath, 'utf8');
      if (existing !== pageJsonContent) {
        jsonBackupPath = `${jsonPath}.bak.${Date.now()}`;
        fs.writeFileSync(jsonBackupPath, existing, 'utf8');
        fs.writeFileSync(jsonPath, pageJsonContent, 'utf8');
        jsonCreated = true;
      }
    } else {
      fs.writeFileSync(jsonPath, pageJsonContent, 'utf8');
      jsonCreated = true;
    }

    if (fs.existsSync(jsPath)) {
      const existing = fs.readFileSync(jsPath, 'utf8');
      if (existing !== pageJsContent) {
        jsBackupPath = `${jsPath}.bak.${Date.now()}`;
        fs.writeFileSync(jsBackupPath, existing, 'utf8');
        fs.writeFileSync(jsPath, pageJsContent, 'utf8');
        jsCreated = true;
      }
    } else {
      fs.writeFileSync(jsPath, pageJsContent, 'utf8');
      jsCreated = true;
    }
  } else {
    jsonCreated = !fs.existsSync(jsonPath);
    jsCreated = !fs.existsSync(jsPath);
  }

  return {
    jsonCreated,
    jsonPath,
    jsonBackupPath,
    jsCreated,
    jsPath,
    jsBackupPath,
    pageDir,
  };
}
