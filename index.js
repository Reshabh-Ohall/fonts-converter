#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const args = process.argv.slice(2);

// Standard ANSI Escape Colors (Vite Style + Dynamic Brand Layouts)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  purple: '\x1b[38;5;105m', 
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  hideCursor: '\x1b[?25l',
  showCursor: '\x1b[?25h',

  // Custom option branding colors
  css: '\x1b[38;5;39m',         
  cssBright: '\x1b[1m\x1b[38;5;45m',
  scss: '\x1b[38;5;197m',       
  scssBright: '\x1b[1m\x1b[38;5;205m',
  ttf: '\x1b[38;5;76m',         
  ttfBright: '\x1b[1m\x1b[38;5;82m',
  otf: '\x1b[38;5;214m',        
  otfBright: '\x1b[1m\x1b[38;5;220m',
  both: '\x1b[38;5;141m',       
  bothBright: '\x1b[1m\x1b[38;5;147m'
};

// Map common layout weights, abbreviations, and project initials to CSS properties and short naming fragments
function getFontDetails(fileName) {
  const lower = fileName.toLowerCase();
  let weight = '400';
  let style = 'normal';
  
  let weightAbbr = 'Rg';
  let styleAbbr = '';

  if (lower.includes('italic')) {
    style = 'italic';
    styleAbbr = '_Ital';
  }

  if (lower.includes('extrabold')) {
    weight = '800';
    weightAbbr = 'Ex_Bd';
  } else if (lower.includes('semibold')) {
    weight = '600';
    weightAbbr = 'Semi_Bd';
  } else if (lower.includes('bold')) {
    weight = '700';
    weightAbbr = 'Bd';
  } else if (lower.includes('heavy') || lower.includes('_he')) {
    weight = '900';
    weightAbbr = 'He';
  } else if (lower.includes('medium')) {
    weight = '500';
    weightAbbr = 'Md';
  } else if (lower.includes('extralight')) {
    weight = '200';
    weightAbbr = 'Ex_Lt';
  } else if (lower.includes('light') || lower.includes('_lt')) {
    weight = '300';
    weightAbbr = 'Lt';
  } else if (lower.includes('thin')) {
    weight = '100';
    weightAbbr = 'Th';
  } else if (lower.includes('_rg') || lower.includes('regular')) {
    weight = '400';
    weightAbbr = 'Rg';
  }

  if (style === 'italic' && weightAbbr === 'Rg' && !lower.includes('regular') && !lower.includes('_rg')) {
    weightAbbr = ''; 
    styleAbbr = 'Ital';
  }

  const parts = fileName.split(/[-_\s]+/);
  // FIXED: Explicit array index zero mapping applied cleanly
  const firstPart = parts[0]; 

  let fileInitialPrefix = firstPart;
  let cssFontFamily = firstPart;
  
  const upperCaseMatches = firstPart.match(/[A-Z]/g);
  if (upperCaseMatches && upperCaseMatches.length > 1) {
    fileInitialPrefix = upperCaseMatches.join(''); 
    cssFontFamily = firstPart.replace(/([A-Z])/g, ' $1').trim(); 
  } else {
    fileInitialPrefix = firstPart.charAt(0).toUpperCase() + firstPart.slice(1);
    cssFontFamily = fileInitialPrefix;
  }

  let cleanSuffix = weightAbbr + styleAbbr;
  if (weightAbbr && styleAbbr) {
    cleanSuffix = weightAbbr + styleAbbr;
  }
  
  const shortFileName = cleanSuffix ? fileInitialPrefix + '_' + cleanSuffix : fileInitialPrefix;

  return { cssFontFamily, fileInitialPrefix, weight, style, shortFileName };
}

// Helper function to recursively read matching files based on an array of extensions
function getFilesRecursive(dir, allowedExts, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      getFilesRecursive(filePath, allowedExts, fileList);
    } else {
      const fileExt = path.extname(file).toLowerCase().replace('.', '');
      if (allowedExts.includes(fileExt)) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// Helper function to render a real-time progress bar in the terminal (Vite colors)
function drawProgressBar(current, total, currentFileName) {
  const percentage = Math.round((current / total) * 100);
  const barLength = 25; 
  const filledLength = Math.round((barLength * current) / total);
  
  const bar = (C.purple + "█" + C.reset).repeat(filledLength) + (C.dim + "░" + C.reset).repeat(barLength - filledLength);
  
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write("  " + C.bold + C.purple + "🗲" + C.reset + " [" + bar + "] " + C.bold + percentage + "%" + C.reset + " " + C.dim + "| Transform:" + C.reset + " " + C.cyan + currentFileName + C.reset);
}

function executeConversion(srcExts, stylesheetFormat, isInteractive = false) {
  process.stdout.write(C.showCursor);
  const startTime = Date.now();
  const currentDir = process.cwd();
  const targetFiles = getFilesRecursive(currentDir, srcExts);

  if (targetFiles.length === 0) {
    console.error("\n  " + C.red + "✗ Error:" + C.reset + " No files matching [" + C.yellow + srcExts.join(', ') + C.reset + "] found in this workspace.\n");
    process.exit(1);
  }

  console.log("\n  " + C.green + "✓" + C.reset + " Found " + C.bold + targetFiles.length + C.reset + " assets across target extensions. Transforming modules...\n");
  
  const localCssMap = {}; 
  const localScssMap = {};
  const folderMetaMap = {}; 
  let masterCssContent = "/* Master Stylesheet - Generated by fonts-converter */\n\n";
  let masterScssContent = "/* Master SCSS Stylesheet - Generated by fonts-converter */\n\n";

  // Safely grab the first available item from file queue array to cleanly spin up loader
  const initialFileLabel = targetFiles.length > 0 ? path.basename(targetFiles[0]) : '';
  drawProgressBar(0, targetFiles.length, initialFileLabel);

  targetFiles.forEach((absoluteFilePath, index) => {
    const fileFolder = path.dirname(absoluteFilePath);
    const baseName = path.basename(absoluteFilePath, path.extname(absoluteFilePath));
    const { cssFontFamily, fileInitialPrefix, weight, style, shortFileName } = getFontDetails(baseName);
    
    const outputFile = shortFileName + ".woff2";
    const absoluteOutputPath = path.join(fileFolder, outputFile);
    const relativePathToAsset = path.relative(currentDir, absoluteOutputPath).replace(/\\/g, '/');
    
    try {
      execSync("ttf2woff2 < \"" + absoluteFilePath + "\" > \"" + absoluteOutputPath + "\"", { stdio: 'ignore' });
      
      if (!localCssMap[fileFolder]) localCssMap[fileFolder] = {};
      if (!localScssMap[fileFolder]) localScssMap[fileFolder] = {};
      
      const targetGroupKey = fileInitialPrefix;
      folderMetaMap[fileFolder] = { prefix: fileInitialPrefix, readableName: cssFontFamily };

      if (!localCssMap[fileFolder][targetGroupKey]) localCssMap[fileFolder][targetGroupKey] = "/* Generated by fonts-converter for " + cssFontFamily + " */\n\n";
      if (!localScssMap[fileFolder][targetGroupKey]) localScssMap[fileFolder][targetGroupKey] = "/* SCSS Mixins Generated for " + cssFontFamily + " */\n\n";

      const cssRule = "@font-face {\n  font-family: '" + cssFontFamily + "';\n  src: url('./" + outputFile + "') format('woff2');\n  font-weight: " + weight + ";\n  font-style: " + style + ";\n  font-display: swap;\n}\n\n";
      const scssRule = "@mixin font-" + fileInitialPrefix.toLowerCase() + "-" + weight + "-" + style + " {\n  font-family: '" + cssFontFamily + "';\n  font-weight: " + weight + ";\n  font-style: " + style + ";\n}\n\n" + cssRule;

      localCssMap[fileFolder][targetGroupKey] += cssRule;
      localScssMap[fileFolder][targetGroupKey] += scssRule;

      masterCssContent += "@font-face {\n  font-family: '" + cssFontFamily + "';\n  src: url('./" + relativePathToAsset + "') format('woff2');\n  font-weight: " + weight + ";\n  font-style: " + style + ";\n  font-display: swap;\n}\n\n";
      masterScssContent += "@mixin font-" + fileInitialPrefix.toLowerCase() + "-" + weight + "-" + style + " {\n  font-family: '" + cssFontFamily + "';\n  font-weight: " + weight + ";\n  font-style: " + style + ";\n}\n\n@font-face {\n  font-family: '" + cssFontFamily + "';\n  src: url('./" + relativePathToAsset + "') format('woff2');\n  font-weight: " + weight + ";\n  font-style: " + style + ";\n  font-display: swap;\n}\n\n";

    } catch (err) {
      console.error("\n  " + C.red + "✗ Failed to process " + baseName + ":" + C.reset, err.message);
    }

    drawProgressBar(index + 1, targetFiles.length, path.basename(absoluteFilePath));
  });

  console.log('\n');

  // Unified File System Writer Execution
  function saveFiles(namesConfig) {
    const rootName = namesConfig.root || '';
    
    if (stylesheetFormat === 'css' || stylesheetFormat === 'both') {
      Object.keys(localCssMap).forEach(folderPath => {
        Object.keys(localCssMap[folderPath]).forEach(prefix => {
          const customFolderOverride = namesConfig[folderPath] || prefix;
          fs.writeFileSync(path.join(folderPath, customFolderOverride + ".css"), localCssMap[folderPath][prefix].trim() + '\n');
        });
      });
      const resolvedMasterName = rootName ? rootName + ".css" : 'fonts.css';
      fs.writeFileSync(path.join(currentDir, resolvedMasterName), masterCssContent.trim() + '\n');
      console.log("  " + C.green + "✓" + C.reset + " Generated CSS: " + C.cyan + resolvedMasterName + C.reset);
    }

    if (stylesheetFormat === 'scss' || stylesheetFormat === 'both') {
      Object.keys(localScssMap).forEach(folderPath => {
        Object.keys(localScssMap[folderPath]).forEach(prefix => {
          const customFolderOverride = namesConfig[folderPath] || prefix;
          fs.writeFileSync(path.join(folderPath, "_" + customFolderOverride + ".scss"), localScssMap[folderPath][prefix].trim() + '\n');
        });
      });
      const resolvedMasterName = rootName ? rootName + ".scss" : 'fonts.scss';
      fs.writeFileSync(path.join(currentDir, resolvedMasterName), masterScssContent.trim() + '\n');
      console.log("  " + C.green + "✓" + C.reset + " Generated SCSS: " + C.cyan + resolvedMasterName + C.reset);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("  " + C.green + "✓ built in " + C.bold + duration + "s" + C.reset + "\n");
    process.exit(0);
  }

  if (isInteractive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const collectedNames = {};
    const foldersToPrompt = Object.keys(folderMetaMap);
    let promptIndex = 0;

    function askNext() {
      if (promptIndex === 0) {
        rl.question("  " + C.bold + "→ Custom name for stylesheet file @ root" + C.reset + " " + C.dim + "(Press <enter> for fonts):" + C.reset + " ", (input) => {
          collectedNames.root = input.trim().replace(/\.(css|scss)$/i, '');
          promptIndex++;
          askNext();
        });
      } else if (promptIndex <= foldersToPrompt.length) {
        const currentFolder = foldersToPrompt[promptIndex - 1];
        const { readableName, prefix } = folderMetaMap[currentFolder];
        
        rl.question("  " + C.bold + "→ Custom name for stylesheet file @ " + readableName + C.reset + " " + C.dim + "(Press <enter> for " + prefix + "):" + C.reset + " ", (input) => {
          collectedNames[currentFolder] = input.trim().replace(/\.(css|scss)$/i, '');
          promptIndex++;
          askNext();
        });
      } else {
        rl.close();
        saveFiles(collectedNames);
      }
    }
    askNext();
  } else {
    saveFiles({});
  }
}

// Native Multiselect CLI Engine
function promptSelectMenu(questionText, options, isMultiSelect, callback) {
  let cursor = 0;
  const selected = options.map((_, i) => i === 0 && !isMultiSelect);

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdout.write(C.hideCursor);

  function renderMenu() {
    process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); 
    console.log("\n  " + C.bold + C.purple + "FONTS-CONVERTER" + C.reset + " " + C.dim + "v1.1.0" + C.reset);
    console.log("  " + C.dim + "ready to optimize typography workspace assets" + C.reset + "\n");
    console.log("  " + C.cyan + "?" + C.reset + " " + C.bold + questionText + C.reset + " " + C.dim + (isMultiSelect ? '(Press <space> to select, <enter> to confirm)' : '(Use arrow keys, <enter> to confirm)') + C.reset + "\n");

    options.forEach((opt, index) => {
      const isCurrent = cursor === index;
      const isSel = selected[index];
      const key = opt.toLowerCase();
      
      let marker = ' ';
      if (isMultiSelect) {
        marker = isSel ? "[" + C.green + "x" + C.reset + "]" : '[ ]';
      }
      
      const pointer = isCurrent ? C.purple + "❯" + C.reset + " " : '  ';
      let colorCode = C.reset;
      if (C[key]) {
        colorCode = isCurrent ? C[key + "Bright"] : (isSel ? C[key] : C.dim + C[key]);
      } else {
        colorCode = isCurrent ? C.bold + C.purple : (isSel ? C.reset : C.dim);
      }
      
      const label = colorCode + opt + C.reset;
      console.log("  " + pointer + marker + " " + label);
    });
  }

  renderMenu();

  function onKeypress(str, key) {
    if (key.ctrl && key.name === 'c') {
      process.stdout.write(C.showCursor);
      process.exit();
    }

    if (key.name === 'up') {
      cursor = (cursor - 1 + options.length) % options.length;
      renderMenu();
    } else if (key.name === 'down') {
      cursor = (cursor + 1) % options.length;
      renderMenu();
    } else if (key.name === 'space' && isMultiSelect) {
      selected[cursor] = !selected[cursor];
      renderMenu();
    } else if (key.name === 'return') {
      process.stdin.removeListener('keypress', onKeypress);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      
      if (isMultiSelect) {
        const result = options.filter((_, i) => selected[i]);
        callback(result.length ? result : [options]);
      } else {
        callback(options[cursor]);
      }
    }
  }

  process.stdin.on('keypress', onKeypress);
}

// --- INTERACTIVE / NON-INTERACTIVE ROUTER ---
const toIndex = args.indexOf('to');

if (args.length === 0) {
  promptSelectMenu('Select input font file extensions to convert:', ['ttf', 'otf'], true, (selectedExts) => {
    promptSelectMenu('Select output stylesheet syntax format:', ['css', 'scss', 'both'], false, (selectedFormat) => {
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      console.log("\n  " + C.bold + C.purple + "FONTS-CONVERTER" + C.reset + " " + C.dim + "v1.1.0" + C.reset);
      executeConversion(selectedExts, selectedFormat, true);
    });
  });
} else if (args === 'from' && toIndex > 1 && args[toIndex + 1] === 'woff2') {
  console.log("\n  " + C.bold + C.purple + "FONTS-CONVERTER" + C.reset + " " + C.dim + "v1.1.0" + C.reset);
  const srcExts = args.slice(1, toIndex).map(ext => ext.toLowerCase());
  executeConversion(srcExts, 'both', false);
} else {
  console.log("\n  " + C.red + "✗ Invalid Syntax Format." + C.reset);
  console.log("  " + C.dim + "Use one of these verified signatures:" + C.reset);
  console.log("    $ fonts-converter");
  console.log("    $ fonts-converter from ttf to woff2");
  console.log("    $ fonts-converter from ttf otf to woff2\n");
}
