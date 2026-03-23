module.exports = {
    apps: [
        {
            name: "esl-api",
            script: "./apps/api/dist/index.js",
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "esl-worker",
            script: "./apps/worker/dist/index.js",
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "esl-broker",
            script: "./apps/broker/dist/index.js",
            env: {
                NODE_ENV: "production"
            }
        },
        {
            name: "esl-web",
            script: "serve",
            env: {
                PM2_SERVE_PATH: "./apps/web/dist",
                PM2_SERVE_PORT: 8000,
                PM2_SERVE_SPA: "true",
                PM2_SERVE_HOMEPAGE: "/index.html"
            }
        }
    ]
};
