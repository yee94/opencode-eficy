const runtimePackages = ['@eficy/browser', '@eficy/shadcn-ui', 'react', 'react-dom', 'sucrase'];

/** @param {{version: string, dependencies?: Record<string, string>, devDependencies?: Record<string, string>}} pkg */
export function runtimeManifest(pkg) {
  const manifest = {
    pluginVersion: pkg.version,
    packages: Object.fromEntries(runtimePackages.map(name => [name, pkg.devDependencies?.[name] ?? pkg.dependencies?.[name]])),
  };
  for (const [name, version] of Object.entries({ plugin: manifest.pluginVersion, ...manifest.packages })) {
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) {
      throw new Error(`Expected an exact version for ${name}`);
    }
  }
  return manifest;
}
