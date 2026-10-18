# Verify the Pages deployment destination

## What happened

Wrangler redirected a Pages project creation command to Workers and redeployed the existing compressor Worker. The prepared Pages script also used a custom config filename, which Pages does not support.

## Impact

The first command updated the wrong hosting project and did not create the requested pages.dev site.

## Why it happened

The command name was assumed to guarantee its hosting destination, and Workers configuration flags were reused for Pages without checking compatibility.

## Learning and required prevention

Check the actual returned hostname and project type. For explicitly requested Pages hosting, use the Pages creation compatibility flag when required. Keep Pages configuration in wrangler.jsonc and any retained Worker configuration in a separate file selected by its deploy command. Verify the pages.dev URL before reporting deployment complete.
