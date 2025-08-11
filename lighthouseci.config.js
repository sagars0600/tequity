module.exports = {
  ci: {
    collect: {
      staticDistDir: './build',
      url: ['http://localhost:3000'],
      startServerCommand: 'npm start',
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
