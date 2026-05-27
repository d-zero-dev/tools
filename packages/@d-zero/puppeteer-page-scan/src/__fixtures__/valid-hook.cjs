/* eslint-disable no-undef */
module.exports = async function hook(page, ctx) {
	ctx.log(`valid-hook.cjs ran on ${ctx.name}`);
};
