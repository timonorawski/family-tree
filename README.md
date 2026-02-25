# Family Tree

An interactive family tree viewer and editor. Click on people in the tree to see their details, edit their information, and add new relatives.

## Getting started

You'll need **Node.js** installed (version 18 or newer).

### Check if you have Node.js

Open **Terminal** (on Mac, search for "Terminal" in Spotlight) and type:

```
node --version
```

If you see a version number like `v18.x.x` or higher, you're good. If not, install Node.js from https://nodejs.org (choose the LTS version).

### Download and run

1. Open Terminal and navigate to where you downloaded this project:

   ```
   cd ~/path/to/FamilyTree
   ```

2. Install dependencies (only needed the first time, or after updates):

   ```
   npm install
   ```

3. Start the app:

   ```
   npm run dev
   ```

4. Open your browser to the address shown (usually **http://localhost:5173**)

That's it! The tree should appear. Click on any person to open their details in the sidebar.

### Stopping the app

Go back to Terminal and press **Ctrl+C**.

## Using the app

- **Click a person** in the tree to open their details in the sidebar
- **View mode** (default): shows a read-only summary of the person
- **Edit**: click the Edit button in the sidebar header to switch to the form
- **Save / Cancel**: save your changes or discard them
- **Delete**: removes the person from the tree
- **Add relatives**: use the + Parent / + Sibling / + Partner / + Child buttons at the bottom of the sidebar

## Where the data lives

All person data is stored as individual files in `data/persons/`. Each person is a `.yaml` file (a simple text format). You can open these in any text editor if you want to look at the raw data, but it's easier to use the app.

## Build modes

The app supports several build modes for different deployment scenarios.

### Development (default)

```bash
npm run dev
```

Runs the full-featured dev server with hot reload and API endpoints for editing.

### Static build (public, unencrypted)

```bash
npm run build:static
npx serve build
```

Generates a static site in `build/` with all data embedded. No server required - can be hosted on any CDN or static host.

### Encrypted static build

For sharing with specific groups while keeping data private. Uses client-side decryption with tiered access control.

#### Setup

1. Generate a master secret (keep this safe!):
   ```bash
   openssl rand -hex 32
   ```

2. Configure environment variables (in `.env` or export):
   ```bash
   STATIC_CRYPT_SECRET=<your-64-char-hex-secret>
   STATIC_CRYPT_TIERS=family,extended    # comma-separated tier names
   STATIC_CRYPT_BASE_URL=https://your-site.com/
   ```

#### Build

```bash
npm run build:encrypted
```

This creates:
- `build/` - the static site
- `build/data/persons.<tier>.enc` - encrypted data for each tier

#### Generate access QR codes

```bash
# Single tier
npx static-crypt qr family --out ./qrcodes/

# All tiers
npx static-crypt qr --all --out ./qrcodes/
```

QR codes encode URLs like `https://your-site.com/#t=family&k=<tier-key>`. Share the QR code (or URL) with people who should have access.

#### Revocation

To revoke a tier's access, simply delete its `.enc` file from your CDN/host. Users with that tier's key will see a "Content not available" message.

### Encrypted dev mode

Test encryption locally without building:

```bash
VITE_ENCRYPTED=true STATIC_CRYPT_SECRET=<secret> npm run dev
```

The dev server auto-encrypts data on-the-fly. Access with the tier key in the URL fragment:
```
http://localhost:5173/#t=family&k=<tier-key>
```

### Docker builds

#### Static (unencrypted)

```bash
docker compose up web
```

#### Encrypted

```bash
STATIC_CRYPT_SECRET=<secret> docker compose --profile encrypted up --build
```

Or build directly:

```bash
docker build --target encrypted \
  --build-arg STATIC_CRYPT_SECRET=<secret> \
  --build-arg STATIC_CRYPT_TIERS=family,extended \
  -t familytree:encrypted .
```

#### Editable (with persistent storage)

```bash
docker compose --profile edit up
```

## CLI reference

The `static-crypt` CLI is available for encryption and QR code generation:

```bash
# Encrypt a file for multiple tiers
npx static-crypt encrypt data.json --tiers family,extended --out ./encrypted/

# Generate QR code for a tier
npx static-crypt qr family --base-url https://example.com/ --out ./qrcodes/

# Generate QR codes for all tiers
npx static-crypt qr --all --out ./qrcodes/

# Show help
npx static-crypt --help
```

Environment variables:
- `STATIC_CRYPT_SECRET` - Master secret (64-char hex)
- `STATIC_CRYPT_TIERS` - Default tier list (comma-separated)
- `STATIC_CRYPT_BASE_URL` - Base URL for QR codes
