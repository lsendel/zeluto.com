# Rspamd Normal Worker Configuration
# Listens for milter connections from Postfix

bind_socket = "*:11333";

# Number of worker instances
count = 2;

# Task timeout
task_timeout = 30s;
