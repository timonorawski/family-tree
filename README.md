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
