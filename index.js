
var rl, readline = require('readline'); // require interaction with users

/**
 * Creates an interface
 * @param {*} stdin - a input comes from the terminal ("standard in")
 * @param {*} stdout - output goes to the terminal ("standard out")
 * @returns {*} rl
 */
var get_interface = function(stdin, stdout) {
  if (!rl) rl = readline.createInterface(stdin, stdout);
  else stdin.resume(); // interface exists
  return rl;
}

/**
 * Confirm again with users about their choice
 * @param {String} message - prompt to confirm
 * @callback callback - function that is passed to this function
 * @returns {Function} callback - callback function
 */
var confirm = exports.confirm = function(message, callback) {

  var question = {
    'reply': {
      type: 'confirm',
      message: message,
      default: 'yes'
    }
  }

  get(question, function(err, answer) {
    if (err) return callback(err);
    callback(null, answer.reply === true || answer.reply == 'yes');
  });

};

/**
 * get specific information for a user
 * @param {Array} options - Array of elements from which the user is expected to give a valid answer from
 * @callback callback - function that is passed to this function
 * @returns {Function} callback - call back function 
 */
var get = exports.get = function(options, callback) {

  if (!callback) return; // no point in continuing

  if (typeof options != 'object')
    return callback(new Error("Please pass a valid options object."))

  var answers = {},
      stdin = process.stdin,
      stdout = process.stdout,
      fields = Object.keys(options);

  /**
   * Finish the interaction
   */
  var done = function() {
    close_prompt();
    callback(null, answers);
  }

  /**
   * stop and prompt and close the interface
   */
  var close_prompt = function() {
    stdin.pause();
    if (!rl) return;
    rl.close();
    rl = null;
  }

  /**
   * get default value in case user just presses the enter key
   * @param {String} key -  specific category within options
   * @param {String} partial_answers - user's answers that are partial
   * @returns {String | String} default data for the given key or key's corresponding string in the options
   */
  var get_default = function(key, partial_answers) {
    if (typeof options[key] == 'object')
      return typeof options[key].default == 'function' ? options[key].default(partial_answers) : options[key].default;
    else
      return options[key];
  }

   /**
   * guess type of answer based on users' response
   * @param {String} reply -  user's response
   * @returns {Boolean|Boolean|Number|String} true or false or user's number response or user's string response
   */
  var guess_type = function(reply) {

    if (reply.trim() == '')
      return;
    else if (reply.match(/^(true|y(es)?)$/))
      return true;
    else if (reply.match(/^(false|n(o)?)$/))
      return false;
    else if ((reply*1).toString() === reply)
      return reply*1;

    return reply;
  }

  /**
   * validate users' response is proper based on the existing answers
   * @param {String} key -  specific category within options
   * @param {String} answer - user's response
   * @returns {Boolean} if users' response is proper based on the existing answers
   */
  var validate = function(key, answer) {

    if (typeof answer == 'undefined')
      return options[key].allow_empty || typeof get_default(key) != 'undefined';
    else if(regex = options[key].regex)
      return regex.test(answer);
    else if(options[key].options)
      return options[key].options.indexOf(answer) != -1;
    else if(options[key].type == 'confirm')
      return typeof(answer) == 'boolean'; // answer was given so it should be
    else if(options[key].type && options[key].type != 'password')
      return typeof(answer) == options[key].type;

    return true;

  }

  /**
   * show error message
   * @param {String} key -  specific category within options
   */
  var show_error = function(key) {
    var str = options[key].error ? options[key].error : 'Invalid value.';

    if (options[key].options){
        str += ' (options are ' + options[key].options.join(', ') + ')';
    } stdout.write("\033[31m" + str + "\033[0m \n");
  }

  /**
   * show message of available options
   * @param {String} key -  specific category within options
   */
  var show_message = function(key) {
    var msg = '';

    if (text = options[key].message)
      msg += text.trim() + ' ';

    if (options[key].options)
      msg += '(options are ' + options[key].options.join(', ') + ')';

    if (msg != '') stdout.write("\033[1m" + msg + "\033[0m\n");
  }

  // taken from commander lib
  /**
  * mask possword after user keypress
  * @param {Array} prompt - prompt to ask for password
  * @callback callback - function that is passed to this function
  */
  var wait_for_password = function(prompt, callback) {

    var buf = '',
        mask = '*';

    /**
    * masks possword and closes when finished
    * @param {String} c - indicator to close prompt
    * @param {String} key - the key on keyboard that user pressed
    * @returns {Function} callback function
    */
    var keypress_callback = function(c, key) {

      if (key && (key.name == 'enter' || key.name == 'return')) {
        stdout.write("\n");
        stdin.removeAllListeners('keypress');
        // stdin.setRawMode(false);
        return callback(buf);
      }

      if (key && key.ctrl && key.name == 'c')
        close_prompt();

      if (key && key.name == 'backspace') {
        buf = buf.substr(0, buf.length-1);
        var masked = '';
        for (i = 0; i < buf.length; i++) { masked += mask; } //mask keyword one letter by one letter until the entire keyword is masked
        stdout.write('\r\033[2K' + prompt + masked);
      } else {
        stdout.write(mask);
        buf += c;
      }

    };

    stdin.on('keypress', keypress_callback);
  }

  /**
   * validates users' response and show error if there is any
   * @param {Number} index - index of current category in the options array
   * @param {String} curr_key - current category within options
   * @param {String} fallback - defult answer
   * @param {String} reply - users' response 
   */   
  var check_reply = function(index, curr_key, fallback, reply) {
    var answer = guess_type(reply);
    var return_answer = (typeof answer != 'undefined') ? answer : fallback;

    if (validate(curr_key, answer))
      next_question(++index, curr_key, return_answer);
    else
      show_error(curr_key) || next_question(index); // repeats current
  }

/**
 * check and return if key is dependend on parameter conds 
 * @param {Number} conds - conditions
 * @returns {Boolean} whether key is dependend on conditions or not
 */
  var dependencies_met = function(conds) {
    for (var key in conds) {
      var cond = conds[key];
      if (cond.not) { // object, inverse
        if (answers[key] === cond.not)
          return false;
      } else if (cond.in) { // array 
        if (cond.in.indexOf(answers[key]) == -1) 
          return false;
      } else {
        if (answers[key] !== cond)
          return false; 
      }
    }
    return true;
  }

/**
 * Ask next question until there is none
 * @param {Number} index - index of current category in the options array
 * @param {Number} prev_key - previous category within options
 * @param {String} answer - users' response 
 * @returns {Function} done or next_question
 */
  var next_question = function(index, prev_key, answer) {
    if (prev_key) answers[prev_key] = answer;

    var curr_key = fields[index];
    if (!curr_key) return done();

    if (options[curr_key].depends_on) {
      if (!dependencies_met(options[curr_key].depends_on))
        return next_question(++index, curr_key, undefined);
    }

    var prompt = (options[curr_key].type == 'confirm') ?
      ' - yes/no: ' : " - " + curr_key + ": ";

    var fallback = get_default(curr_key, answers);
    if (typeof(fallback) != 'undefined' && fallback !== '')
      prompt += "[" + fallback + "] ";

    show_message(curr_key);

    if (options[curr_key].type == 'password') {

      var listener = stdin._events.keypress; // to reassign down later
      stdin.removeAllListeners('keypress');

      // stdin.setRawMode(true);
      stdout.write(prompt);

      wait_for_password(prompt, function(reply) {
        stdin._events.keypress = listener; // reassign
        check_reply(index, curr_key, fallback, reply)
      });

    } else {

      rl.question(prompt, function(reply) {
        check_reply(index, curr_key, fallback, reply);
      });

    }

  }

  rl = get_interface(stdin, stdout);
  next_question(0);

  rl.on('close', function() {
    close_prompt(); // just in case

    var given_answers = Object.keys(answers).length;
    if (fields.length == given_answers) return;

    var err = new Error("Cancelled after giving " + given_answers + " answers.");
    callback(err, answers);
  });

}
