module.exports = {
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    ["@semantic-release/changelog", {
      "changelogFile": "CHANGELOG.md",
    }],
    "@semantic-release/npm",
    ["@semantic-release/git", {
      "assets": ["package.json", "CHANGELOG.md"],
      "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
    }],
    ['@adobe/semantic-release-coralogix', {
      iconUrl: 'https://emojipedia-us.s3.dualstack.us-west-1.amazonaws.com/thumbs/240/apple/325/ship_1f6a2.png',
      applications: [
        'fastly' // "but, we aren't even deploying this to Fastly, I hear you say." That is correct. The Coralogix
        // application filter for a tag will only show our releases when the Fastly filter is enabled. As
        // there is no application logging within this project, errors will only become visible in Fastly,
        // hence the application setting.
      ]
    }],
    ["@semantic-release/github", {}]
  ],
  branches: ['main'],
};
