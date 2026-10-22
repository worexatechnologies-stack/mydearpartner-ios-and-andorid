"""
Database Load Balancer Router for Django.

Routes read traffic across available read replica database aliases while
ensuring all writes, schema changes, and transactions go to the primary
(leader) database ('default').
"""

import itertools
import random
import threading
from typing import Any, List, Optional
from django.conf import settings
from django.db import connections


class DatabaseLoadBalancerRouter:
    """
    Primary/Replica Read-Write Split & Load Balancing Database Router.

    - Writes (INSERT, UPDATE, DELETE): always routed to 'default' (primary/leader).
    - Eligible reads (SELECT): load-balanced across configured replica aliases
      ('replica', 'replica_1', 'replica_2', etc.) via round-robin or random.
      If no replicas are configured, uses 'default'. No outage failover is provided.
      Security/payment reads and primary-transaction reads use 'default'.
    - Migrations: only executed on 'default'.
    - Relations: permitted between models within the replicated cluster.
    """

    _lock = threading.Lock()
    _round_robin_counter = itertools.count()

    @classmethod
    def get_read_replicas(cls) -> List[str]:
        """
        Return the list of configured read replica database aliases.
        """
        all_dbs = getattr(settings, 'DATABASES', {})
        replicas = [
            alias for alias in all_dbs.keys()
            if alias.startswith('replica') or alias in ('read_replica', 'read_replica_1', 'read_replica_2')
        ]
        return sorted(replicas)

    def db_for_read(self, model: Any, **hints: Any) -> str:
        """
        Distribute read queries across read replicas if available,
        otherwise fall back to the primary database ('default').
        """
        # Replication lag must never restore a revoked session or stale payment,
        # membership, or safety permissions. Atomic reads must share the write DB.
        if model._meta.app_label in {
            'auth', 'sessions', 'account_sessions', 'payments', 'memberships', 'safety'
        } or connections['default'].in_atomic_block:
            return 'default'
        replicas = self.get_read_replicas()
        if not replicas:
            return 'default'

        strategy = getattr(settings, 'DB_LOAD_BALANCER_STRATEGY', 'round_robin')
        if strategy == 'random':
            return random.choice(replicas)

        # Default: thread-safe round-robin distribution
        with self._lock:
            index = next(self._round_robin_counter) % len(replicas)
            return replicas[index]

    def db_for_write(self, model: Any, **hints: Any) -> str:
        """
        All writes MUST go to the primary/leader database ('default').
        """
        return 'default'

    def allow_relation(self, obj1: Any, obj2: Any, **hints: Any) -> Optional[bool]:
        """
        Allow relations between objects in the database cluster.
        """
        db_set = {'default'} | set(self.get_read_replicas())
        db1 = getattr(obj1._state, 'db', None)
        db2 = getattr(obj2._state, 'db', None)
        if db1 in db_set and db2 in db_set:
            return True
        return None

    def allow_migrate(self, db: str, app_label: str, model_name: Optional[str] = None, **hints: Any) -> bool:
        """
        Only run schema migrations on the primary database ('default').
        Never run migrations on read replicas.
        """
        return db == 'default'
