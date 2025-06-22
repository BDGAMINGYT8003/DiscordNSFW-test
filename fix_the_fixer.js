const fs = require('fs');
const path = require('path');

function fixMissingTryCatchBrace(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Target:
    // try {
    //   ...
    //   if (...) { ... }
    //   else { ... }
    //   // <<< MISSING CLOSING BRACE FOR TRY HERE
    // catch (error) { ... }
    // }

    // Regex looks for an 'else { ... }' block, then whitespace, then 'catch (error) {'
    // It assumes that if this pattern is found within the handleComponent reload logic,
    // a '}' is missing to close the 'try' block.
    const pattern = new RegExp(
        // Capture group 1: The 'else' block and its contents
        `(else\\s*\\{[\\s\\S]*?\\n\\s*\\})` +
        // Capture group 2: Whitespace (including newlines) between 'else }' and 'catch'
        `(\\s*)` +
        // Capture group 3: The 'catch (error) {' block
        `(catch\\s*\\(error\\)\\s*\\{[\\s\\S]*?\\n\\s*console\\.error\\('Error handling (\\w+) reload button:', error\\);)`,
        "gm"
    );

    let changed = false;
    content = content.replace(pattern, (match, elseBlock, whitespace, catchBlock, categoryInCatchLog) => {
        // Heuristic check to ensure we are within handleComponent reload logic
        const textBeforeMatch = originalContent.substring(0, originalContent.indexOf(match));
        if (textBeforeMatch.includes("if (componentType === 'button' && action === 'reload')") &&
            textBeforeMatch.includes("try {await interaction.deferUpdate()")) {

            // Check if a '}' already exists in the whitespace or immediately before catch
            // This is to prevent adding a double '}}' if a file was somehow correctly formatted.
            if (whitespace.trim().endsWith('}')) {
                return match; // Already has a closing brace for the try block
            }

            console.log(`Applying missing brace fix for category '${categoryInCatchLog}' in ${path.basename(filePath)}`);
            changed = true;
            // Insert the missing '}' for the try block, preserving existing whitespace structure as much as possible.
            // Ensure proper indentation for the new brace if whitespace is just newlines.
            let newWhitespace = whitespace;
            if (whitespace.match(/^\s*$/) && whitespace.includes('\n')) { // only newlines and spaces
                const indentMatch = whitespace.match(/(\n)([ \t]*)$/);
                if (indentMatch && indentMatch[2]) {
                    newWhitespace = `\n${indentMatch[2]}} ${indentMatch[1]}${indentMatch[2]}`; //
                } else {
                     newWhitespace = "\n            }\n            ";
                }
            } else {
                 newWhitespace = `${whitespace.trimEnd()}\n            }\n            ${whitespace.trimStart()}`;
            }
            return `${elseBlock}${newWhitespace}${catchBlock}`;
        }
        return match; // Not the context we are looking for
    });

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
    } else {
        // If the above didn't change, try a more direct replacement for exactly "}catch"
        const directPattern = /(\}\s*\n\s*)catch\s*\(/gm; // Closing brace of 'else', whitespace, then 'catch'
        let directChanged = false;
        content = content.replace(directPattern, (match, elseClosingBraceAndWhitespace) => {
             const textBeforeMatch = originalContent.substring(0, originalContent.indexOf(match));
             if (textBeforeMatch.includes("if (componentType === 'button' && action === 'reload')") &&
                 textBeforeMatch.includes("try {await interaction.deferUpdate()")) {

                // Avoid double-fixing if by some chance it's '} } catch'
                if (elseClosingBraceAndWhitespace.trimEnd().endsWith('}')) return match;

                console.log(`Applying direct missing brace fix in ${path.basename(filePath)}`);
                directChanged = true;
                return `${elseClosingBraceAndWhitespace.trimEnd()}\n            } catch (`;
             }
             return match;
        });
        if (directChanged) {
            fs.writeFileSync(filePath, content, 'utf8');
        } else {
            console.log(`No syntax adjustments made to ${filePath} by this script.`);
        }
    }
}

const targetDir = process.argv[2];
if (!targetDir) {
    console.error("Please provide the target directory (e.g., commands).");
    process.exit(1);
}

const filesToProcess = fs.readdirSync(targetDir).filter(file => file.endsWith('.js'));

filesToProcess.forEach(file => {
    const fullPath = path.join(targetDir, file);
    try {
        fixMissingTryCatchBrace(fullPath);
    } catch (error) {
        console.error(`Failed to apply syntax fix to ${file}: ${error.message}\n${error.stack}`);
    }
});
