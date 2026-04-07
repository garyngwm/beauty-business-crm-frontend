// @ts-check

// SET-UP 
// https://www.reddit.com/r/reactjs/comments/1cfn9gr/comment/mgtrpbs/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button
// https://typescript-eslint.io/users/what-about-formatting/#suggested-usage---prettier
// Then finally, going to settings.json (user space) and making prettier the default formatter (+ Prettier plugin enabled)

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strict,
  pluginReact.configs.flat.recommended,
  prettierConfig,
  pluginReact.configs.flat["jsx-runtime"],
  {
    settings: {
      react: {
        version: "detect",
      },
    },

    // If variable starts with _, its considered unused
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
        },
      ],
    }
  }
);