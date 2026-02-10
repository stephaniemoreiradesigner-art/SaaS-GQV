module.exports = {
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script"
  },
  rules: {
    "no-unused-vars": "off",
    "no-undef": "off",
    "no-empty": "off",
    "no-inner-declarations": "off"
  }
};
