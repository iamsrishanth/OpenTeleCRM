module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']],
    'scope-enum': [0, 'always', []],
    'subject-case': [0, 'never', []],
    'header-max-length': [2, 'always', 100],
  },
};
