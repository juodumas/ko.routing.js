/* exported RoutingVM */

var RoutingVM = function(routes) {
  var self = this;

  self.routes = {};

  // The template to be used when there is no matching URI. It is defined by
  // adding an empty URI as a route.
  self.not_found_template = null;
  // Main template.
  self.page_template = ko.observable();
  // Current URI.
  self.uri = ko.observable();
  self.visible_uri = ko.observable();
  // Count routing requests.
  self.counter = 0;

  // Parse and add a route.
  self.add = function(uri, spec) {
    if (uri === '') {
      self.not_found = spec;
      return;
    }
    // If not present, add a slash at the beginning.
    if (uri[0] != '/') {
      uri = '/' + uri;
    }
    // If present, remove a slash at the end of the URI.
    if (uri[uri.length - 1] == '/') {
      uri = uri.slice(0, -1);
    }

    var route = self.routes,
        parts = uri.slice(1).split('/'),
        arg_names = [];
    for (var i = 0, len = parts.length; i < len; i++) {
      var part = parts[i];
      if (part[0] == ':') {
        arg_names.push(part.slice(1));
        part = ':';
      }
      if (!route[part]) {
        route[part] = {};
      }
      route = route[part];
    }
    route['/'] = {
      route_uri: uri,
      arg_names: arg_names,
      data: spec.data,
      template: spec.template
    };
  };

  self.page_not_found = function(uri) {
    self.counter++;
    if (!uri) {
      uri = self.uri();
    }
    if (self.not_found) {
      if (typeof self.not_found == 'function')
        self.page_template(self.not_found.call(self, uri));
      else
        self.page_template({'name': self.not_found, data: {uri: uri}});
    }
    else {
      self.route('/');
    }
  };

  // Route the given URI.
  self.route = function(uri) {
    var route = self.routes,
        parts = uri.slice(1).split('/'),
        args = [],
        i, len;

    self.counter++;

    if (!uri) {
      uri = '/';
    }
    // Parse the given uri.
    for (i = 0, len = parts.length; i < len; i++) {
      var part = parts[i];
      if (route[part] && (i != len - 1 || route[part]['/'])) {
        route = route[part];
      }
      else if (route[':']) {
        args.push(decodeURIComponent(part));
        route = route[':'];
      }
      else {
        break;
      }
    }

    // Set the current URI.
    self.uri(uri);

    // Route not found.
    if (i != parts.length || !route['/']) {
      self.page_not_found(uri);
      return false;
    }

    // Route found, route it.
    var route_data = route['/'],
        arg_names = route_data.arg_names,
        args_object = {
          uri_parts: parts
        },
        data,
        current_template = self.page_template();
    for (i = 0, len = args.length; i < len; i++) {
      args_object[arg_names[i]] = args[i];
    }
    // Expect a ViewModel.
    if (typeof route_data.data == 'function') {
      // If the ViewModel is the same as in the current route and the ViewModel
      // has an update_args function, call the function and don't change the
      // page template.
      if (current_template) {
        var current_vm = current_template.data;
        if (current_vm && current_vm.constructor == route_data.data && current_vm.route_args_changed) {
          current_vm.route_args_changed(args_object);
          return true;
        }
      }
      var counter = self.counter;
      data = new route_data.data(args_object);
      // route_data.data can reroute during instantiation. Abort current route
      // if this is the case.
      if (self.counter != counter)
        return false;
    }
    else {
      data = route_data.data;
    }
    if (current_template && current_template.data && current_template.data.route_before_leave) {
      current_template.data.route_before_leave();
    }
    self.page_template({name: route_data.template, data: data});
  };

  self.navigate = function(uri) {
    window.location.hash = uri;
  };

  // Parse the hash in the current URL.
  self.parse_hash = function() {
    // Can't use location.hash because of Firefox: https://bugzil.la/483304
    var uri = window.location.toString(),
        hash_start = uri.lastIndexOf('#');
    
    if (hash_start == -1)
      return '';

    uri = uri.slice(hash_start + 1);
    // If not present, add a slash at the beginning.
    if (uri[0] != '/')
      uri = '/' + uri;
    // If present, remove a slash at the end.
    if (uri[uri.length - 1] == '/')
      uri = uri.slice(0, -1);

    return uri;
  };
  
  self.onhashchange = function() {
    var uri = self.parse_hash();
    self.route(uri);
    self.visible_uri(uri);
  };

  // Listen to hash change events and route to the current URI.
  self.start = function() {
    window.addEventListener("hashchange", self.onhashchange, false);
    self.onhashchange();
  };

  // If routes are provided in the constructor, we parse them one by one and
  // then start routing. The add() function can also be used after
  // construction.
  if (routes) {
    for (var route_uri in routes) {
      self.add(route_uri, routes[route_uri]);
    }
    self.start();
  }
};
