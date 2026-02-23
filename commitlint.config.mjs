export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'perf', 'docs', 'test', 'ci', 'deps', 'chore']],
    'subject-max-length': [2, 'always', 100],
  },
};
