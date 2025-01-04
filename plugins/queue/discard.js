// discard

exports.register = function () {
    this.register_hook('queue',          'discard');
    this.register_hook('queue_outbound', 'discard');
}

exports.discard = function (next, connection) {
    connection.loginfo("[queue/discard] Discarding email... discard_ok=true");
    next(OK); // Signal success
};
