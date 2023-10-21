module.exports = {
  devServer: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://api.dify.ai',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/v1'
        }
      },
    },
  }
}