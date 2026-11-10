function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export async function downloadGitHubAppZip(): Promise<void> {
  const response = await fetch('/api/export/github-zip');
  if (!response.ok) {
    const errPayload = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errPayload.error || `Failed to export GitHub ZIP (${response.status})`);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, 'Prime-One-GitHub-App.zip');
}

export async function downloadStandaloneHtml(): Promise<void> {
  const response = await fetch('/api/export/html');
  if (!response.ok) {
    const errPayload = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errPayload.error || `Failed to export standalone HTML (${response.status})`);
  }

  const blob = await response.blob();
  triggerBlobDownload(blob, 'Prime-One-Player.html');
}

export async function fetchWorkflowYaml(): Promise<string> {
  const response = await fetch('/api/export/workflow');
  if (!response.ok) {
    const errPayload = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(errPayload.error || `Failed to load GitHub workflow (${response.status})`);
  }
  return response.text();
}

export async function downloadWorkflowYaml(): Promise<void> {
  const yaml = await fetchWorkflowYaml();
  const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
  triggerBlobDownload(blob, 'build-android-apk.yml');
}
