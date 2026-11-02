# Unlock the premium (Deluxe) tools: step-by-step guide

This guide is for people who do not write code. It shows how to make the premium data file from your own copy of the *Worlds Without Number* Deluxe PDF, on Windows or on a Mac.

You do these steps one time. After that, the premium tools stay unlocked in your browser.

## What you need

- A Windows 10/11 computer or a Mac.
- Your own copy of the Deluxe PDF (for example `WorldsWithoutNumber_DeluxePDF.pdf`). The free-edition PDF does not work.
- An internet connection.
- About 15 minutes.

## What happens

1. You download the app's files to your computer.
2. You install Node.js, a free program that runs the app's tools.
3. You run one command. It reads your PDF and writes the file `premium.json`.
4. You load `premium.json` in the app.

The PDF and `premium.json` stay on your computer. Nothing is uploaded. Do not share `premium.json` with other people. It contains text from the Deluxe book.

## Step 1: Download the app's files

You have two options. Option A is the easiest.

### Option A: Download a ZIP file (no extra programs)

1. Open https://github.com/stories-with-dice/worlds-without-number-builder in your browser.
2. Click the green **Code** button.
3. Click **Download ZIP**.
4. Find the ZIP file in your **Downloads** folder and unzip it:
   - **Windows:** Right-click the file. Click **Extract All…**, then **Extract**.
   - **Mac:** Double-click the file.
5. You now have a folder named `worlds-without-number-builder-main`. Move it to a place that is easy to find, for example your **Documents** folder.

### Option B: Clone with Git

Use this option if you already use Git, or if you want to get updates later with one command.

1. Install Git:
   - **Windows:** Download it from https://git-scm.com/download/win and run the installer. Keep all the default settings.
   - **Mac:** Git comes with the Mac developer tools. If they are missing, the `git clone` command below opens a window that asks you to install them. Click **Install**, wait until it is done, and run the command again.
2. Open a terminal window (see [How to open a terminal](#how-to-open-a-terminal)).
3. Type this command and press **Enter**:

   ```bash
   git clone https://github.com/stories-with-dice/worlds-without-number-builder.git
   ```

   Git makes the folder `worlds-without-number-builder` in your home folder.

4. To get updates later, open a terminal in that folder and run `git pull`.

## Step 2: Install Node.js

1. Open https://nodejs.org in your browser.
2. Download the version marked **LTS**. The app needs version 20 or later.
   - **Windows:** Download the **Windows Installer (.msi)**.
   - **Mac:** Download the **macOS Installer (.pkg)**.
3. Open the file you downloaded. Click **Next** or **Continue** on each screen and keep the default settings.
   - **Windows:** If the installer asks about "Tools for Native Modules", leave that box empty. You do not need it.
   - **Mac:** The installer asks for your Mac password. This is normal.
4. When the installer is done, close all terminal windows that are open. A new terminal window finds Node.js; an old one does not.

To check the installation, open a new terminal and run:

```bash
node --version
```

You see a version number, for example `v22.11.0`. If you see "not recognized" or "command not found", restart the computer and try again.

## Step 3: Open a terminal in the app folder

A terminal is a window where you type commands. Each command must run inside the app folder.

### Windows

1. Open the app folder in **File Explorer**. Open it far enough that you see the file `package.json`.
2. Click the address bar at the top of the window (where the folder path shows).
3. Type `cmd` and press **Enter**.

A black **Command Prompt** window opens in the app folder.

Use Command Prompt, not PowerShell. PowerShell can block the `npm` command with an error about "running scripts is disabled".

### Mac

1. Open **Terminal**. Press **Command + Space**, type `Terminal`, and press **Enter**.
2. Type `cd` and then one space. Do not press **Enter** yet.
3. Drag the app folder from **Finder** into the Terminal window. Terminal adds the folder path after `cd`.
4. Press **Enter**.

To check that you are in the correct folder, run `ls` (Mac) or `dir` (Windows). You see `package.json` in the list.

## Step 4: Install the app's parts

In the terminal from step 3, run:

```bash
npm install
```

This downloads the parts that the app needs into the folder `node_modules`. It takes one or two minutes. Warnings in yellow are normal. Red text that says `ERR!` is an error (see [Problems and fixes](#problems-and-fixes)).

## Step 5: Make premium.json from your PDF

1. In the same terminal, type this text, with a space at the end. Do not press **Enter** yet.

   ```text
   npm run premium --
   ```

2. Drag your Deluxe PDF from File Explorer or Finder into the terminal window. The terminal adds the path of the PDF.
3. Press **Enter**.

The full command looks like this:

- **Windows:** `npm run premium -- "C:\Users\you\Downloads\WorldsWithoutNumber_DeluxePDF.pdf"`
- **Mac:** `npm run premium -- /Users/you/Downloads/WorldsWithoutNumber_DeluxePDF.pdf`

The command takes less than a minute. When it is done, it shows a line like this:

```text
Wrote premium/premium.json: 65/65 tables, 100 seeds, 0 warnings.
```

The numbers can be different. A few warnings are acceptable. The file is now in the folder `premium` inside the app folder.

If you see "This does not look like the Deluxe edition", the PDF is the free edition. Use the Deluxe PDF.

## Step 6: Use the premium tools

You have two options.

### Option A: Use the online app (easiest)

1. Open https://stories-with-dice.github.io/worlds-without-number-builder/ in your browser.
2. Click **Load premium.json** in the sidebar.
3. Select the file `premium.json` in the folder `premium` inside the app folder.

The browser keeps the data. You do not need to load the file again in that browser. The data does not leave your computer.

### Option B: Run the app on your computer

1. In the terminal from step 3, run:

   ```bash
   npm run dev
   ```

2. Open the address that the terminal shows, usually http://localhost:5173.

The app loads `premium.json` by itself. Keep the terminal window open while you use the app. To stop the app, click the terminal window and press **Ctrl + C**.

## How to open a terminal

- **Windows:** Press the **Windows** key, type `cmd`, and press **Enter**.
- **Mac:** Press **Command + Space**, type `Terminal`, and press **Enter**.

## Problems and fixes

| What you see | What to do |
|---|---|
| `'node' is not recognized` or `command not found: node` | Close the terminal and open a new one. If that does not help, restart the computer. If it still fails, install Node.js again (step 2). |
| `'npm' is not recognized` | Same as above. |
| `running scripts is disabled on this system` (Windows) | You are in PowerShell. Open Command Prompt as shown in step 3. |
| `ENOENT: no such file or directory, open ...package.json` | The terminal is not in the app folder. Do step 3 again. |
| `PDF not found` | The path to the PDF is wrong. Type `npm run premium -- ` again and drag the PDF into the window. Do not type the path by hand. |
| `This does not look like the Deluxe edition` | Use the Deluxe PDF, not the free PDF. |
| `npm install` shows `ERR!` about the network | Check your internet connection and run `npm install` again. |
| The online app still shows 🔒 | Click **Load premium.json** again and select the file in the `premium` folder. Private or incognito browser windows do not keep the data. |
