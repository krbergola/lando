/**
 * Contains the main bootstrap function.
 *
 * @since 3.0.0
 * @module bootstrap
 * @example
 *
 * // Get the bootstrap function
 * var bootstrap = require('./../lib/bootstrap.js');
 * var options = {
 *   logLevelConsole: LOGLEVELCONSOLE,
 *   userConfRoot: USERCONFROOT,
 *   envPrefix: ENVPREFIX,
 *   configSources: configSources,
 *   pluginDirs: [USERCONFROOT],
 *   mode: 'cli'
 * };
 *
 * // Initialize Lando with some options
 * bootstrap(options)
 *
 * // Initialize some other thing
 * .tap(function(lando) {
 *   return cli.init(lando);
 * })
 */

'use strict';

// Modules
var _ = require('lodash');
var hasher = require('object-hash');

/**
 * The main bootstrap function.
 *
 * This will:
 *
 *   1. Instantiate the lando object.
 *   2. Emit bootstrap events
 *   3. Initialize plugins
 *
 * The intiialization config below is not required but recommended. You can
 * pass in any additional properties to override subsequently set/default values.
 *
 * Check out bin/lando.js for an example
 *
 * @since 3.0.0
 * @name bootstrap
 * @static
 * @fires pre-bootstrap
 * @fires post-bootstrap
 * @param {Object} [options] - Options to initialize the bootstrap
 * @returns {Object} An initialized Lando object
 * @example
 *
 * // Get the bootstrap function
 * var bootstrap = require('./../lib/bootstrap.js');
 *
 * // Initialize Lando with some start up config
 * bootstrap({
 *   logLevelConsole: LOGLEVELCONSOLE,
 *   userConfRoot: USERCONFROOT,
 *   envPrefix: ENVPREFIX,
 *   configSources: configSources,
 *   pluginDirs: [USERCONFROOT],
 *   mode: 'cli'
 * })
 *
 * // Initialize CLI
 * .tap(function(lando) {
 *   return lando.cli.init(lando);
 * })
 */
module.exports = _.once(function(options) {

  // Get our config helpers
  var helpers = require('./config');

  // Start building the config
  var config = helpers.merge(helpers.defaults(), options);

  // If we have configSources let's merge those in as well
  if (!_.isEmpty(config.configSources)) {
    config = helpers.merge(config, helpers.loadFiles(config.configSources));
  }

  // If we have an envPrefix set then lets merge that in as well
  if (_.has(config, 'envPrefix')) {
    config = helpers.merge(config, helpers.loadEnvs(config.envPrefix));
  }

  // Add some final computed properties to the config
  config.id = hasher(config.userConfRoot);

  // Summon lando
  var lando = require('./lando')(config);

  // Log that we've begun
  lando.log.info('Bootstraping...');
  lando.log.silly('It\'s not particularly silly, is it?');

  /**
   * Event that allows other things to augment the lando global config.
   *
   * This is useful so plugins can add additional config settings to the global
   * config.
   *
   * @since 3.0.0
   * @event module:bootstrap.event:pre-bootstrap
   * @property {Object} config The global Lando config
   * @example
   *
   * // Add engine settings to the config
   * lando.events.on('pre-bootstrap', function(config) {
   *
   *   // Get the docker config
   *   var engineConfig = daemon.getEngineConfig();
   *
   *   // Add engine host to the config
   *   config.engineHost = engineConfig.host;
   *
   * });
   */
  return lando.events.emit('pre-bootstrap', lando.config)

  // We should have the fully constructed config at this point
  .then(function() {
    lando.log.debug('Config set: %j', lando.config);
  })

  // Return our plugins so we can init them
  .then(function() {
    return lando.config.plugins || [];
  })

  // Init the plugins
  .map(function(plugin) {
    return lando.plugins.load(plugin, lando.config.pluginDirs, lando);
  })

  /**
   * Event that allows other things to augment the lando object.
   *
   * This is useful so plugins can add additional modules to lando before
   * the bootstrap is completed.
   *
   * @since 3.0.0
   * @event module:bootstrap.event:post-bootstrap
   * @property {Object} lando The Lando object
   * @example
   *
   * // Add the services module to lando
   * lando.events.on('post-bootstrap', function(lando) {
   *   lando.services = require('./services')(lando);
   * });
   */
  .then(function() {
    return lando.events.emit('post-bootstrap', lando);
  })

  // Return a fully initialized lando object
  .then(function() {
    lando.log.info('Bootstrap completed.');
    return lando;
  });

});
