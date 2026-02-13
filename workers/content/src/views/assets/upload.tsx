import type { FC } from 'hono/jsx';

export const AssetUploadView: FC = () => {
  return (
    <div id="asset-upload">
      <div class="flex items-center gap-2 mb-6">
        <a
          href="/app/content/assets"
          hx-get="/app/content/assets"
          hx-target="#app-content"
          hx-push-url="true"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Assets
        </a>
        <span class="text-gray-400">/</span>
        <span class="text-sm text-gray-900">Upload</span>
      </div>

      <h1 class="text-2xl font-bold text-gray-900 mb-6">Upload Asset</h1>

      <form
        hx-post="/api/v1/content/assets"
        hx-target="#app-content"
        hx-swap="innerHTML"
        hx-encoding="multipart/form-data"
        class="max-w-2xl"
      >
        <div class="space-y-6">
          {/* File upload area */}
          <div>
            <label for="file" class="mb-1 block text-sm font-medium text-gray-700">
              File
            </label>
            <div class="mt-1 flex justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 pt-5 pb-6 hover:border-brand-500 transition-colors">
              <div class="text-center">
                <svg
                  class="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <div class="mt-4 flex text-sm text-gray-600">
                  <label
                    for="file"
                    class="relative cursor-pointer rounded-md font-medium text-brand-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 hover:text-brand-500"
                  >
                    <span>Upload a file</span>
                    <input id="file" name="file" type="file" class="sr-only" required />
                  </label>
                  <p class="pl-1">or drag and drop</p>
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  Images, PDFs, documents up to 25MB
                </p>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label for="name" class="mb-1 block text-sm font-medium text-gray-700">
              Display Name (optional)
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Will use filename if left empty"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {/* Folder */}
          <div>
            <label for="folder" class="mb-1 block text-sm font-medium text-gray-700">
              Folder (optional)
            </label>
            <input
              id="folder"
              name="folder"
              type="text"
              placeholder="e.g. images, documents"
              class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div class="mt-8 flex items-center gap-3">
          <button
            type="submit"
            class="inline-flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 transition-colors"
          >
            Upload
          </button>
          <button
            type="button"
            hx-get="/app/content/assets"
            hx-target="#app-content"
            hx-push-url="true"
            class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};
