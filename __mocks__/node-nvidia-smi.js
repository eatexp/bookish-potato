/**
 * Manual mock for node-nvidia-smi module (optional dependency)
 */

const mockNvidiaSmi = jest.fn();

module.exports = mockNvidiaSmi;
module.exports.default = mockNvidiaSmi;
