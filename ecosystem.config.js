// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'deep-brain-test',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'test',
      },
    },
    {
      name: 'deep-brain-prod',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
