module.exports = function buildTargetPlugin({ types }) {
  return {
    name: 'mdp-build-target',
    visitor: {
      StringLiteral(path, state) {
        if (path.node.value === '__MDP_BUILD_TARGET__' &&
            (!state.filename || /[\\/]src[\\/]config[\\/]env\.tsx?(\?.*)?$/.test(state.filename))) {
          path.replaceWith(types.stringLiteral(JSON.stringify(state.opts.target)));
        }
      },
    },
  };
};
