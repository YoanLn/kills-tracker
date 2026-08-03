from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from itsdangerous import URLSafeTimedSerializer, BadSignature
from datetime import date, timedelta
import calendar
import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))

database_url = os.environ.get('DATABASE_URL', '')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
if not database_url:
    data_dir = os.environ.get('DATA_DIR', basedir)
    os.makedirs(data_dir, exist_ok=True)
    database_url = 'sqlite:///' + os.path.join(data_dir, 'data.db')

app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
CORS(app)

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-change-in-prod')
APP_PASSWORD = os.environ.get('APP_PASSWORD', 'imperial')
_signer = URLSafeTimedSerializer(SECRET_KEY)
TOKEN_MAX_AGE = 60 * 60 * 24 * 30


def _verify_token(token):
    try:
        _signer.loads(token or '', max_age=TOKEN_MAX_AGE)
        return True
    except Exception:
        return False


@app.before_request
def check_auth():
    if not request.path.startswith('/api/') or request.path == '/api/login':
        return
    auth = request.headers.get('Authorization', '')
    token = auth[7:] if auth.startswith('Bearer ') else request.args.get('token', '')
    if not _verify_token(token):
        return jsonify({'error': 'unauthorized'}), 401


@app.route('/api/login', methods=['POST'])
def api_login():
    payload = request.get_json() or {}
    if payload.get('password') != APP_PASSWORD:
        return jsonify({'error': 'wrong password'}), 401
    return jsonify({'token': _signer.dumps('ok')})


class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    timezone = db.Column(db.String(8), default='')
    joined_date = db.Column(db.Date, nullable=True)
    hat = db.Column(db.Boolean, default=False)
    entries = db.relationship('DailyEntry', backref='player', lazy=True, cascade='all, delete-orphan')
    monthly_totals = db.relationship('MonthlyTotal', backref='player', lazy=True, cascade='all, delete-orphan')


class DailyEntry(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    kills = db.Column(db.Integer, nullable=True)
    tagtime_hours = db.Column(db.Float, nullable=True)
    __table_args__ = (db.UniqueConstraint('player_id', 'date', name='uq_player_date'),)


class MonthlyTotal(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.Integer, nullable=False)
    kills = db.Column(db.Integer, nullable=True)
    tagtime_hours = db.Column(db.Float, nullable=True)
    __table_args__ = (db.UniqueConstraint('player_id', 'year', 'month', name='uq_player_month'),)


class Period(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    date_start = db.Column(db.Date, nullable=False)
    date_end = db.Column(db.Date, nullable=False)
    weight = db.Column(db.Float, nullable=False, default=1.0)


with app.app_context():
    db.create_all()
    for sql in [
        'ALTER TABLE player ADD COLUMN joined_date DATE',
        'ALTER TABLE player ADD COLUMN hat BOOLEAN DEFAULT FALSE',
        'ALTER TABLE monthly_total ADD COLUMN tagtime_hours FLOAT',
        "UPDATE period SET name='War Phase', date_start='2026-07-06', date_end='2026-07-14', weight=2.0 WHERE name='Tower Week'",
        "UPDATE period SET name='Chill Phase', date_start='2026-07-15', date_end='2026-07-30', weight=1.0 WHERE name='Farm Phase'",
    ]:
        try:
            with db.engine.connect() as conn:
                conn.execute(db.text(sql))
                conn.commit()
        except Exception:
            pass
    if Period.query.count() == 0:
        db.session.add_all([
            Period(name='War Phase', date_start=date(2026, 7, 6), date_end=date(2026, 7, 14), weight=2.0),
            Period(name='Chill Phase', date_start=date(2026, 7, 15), date_end=date(2026, 7, 30), weight=1.0),
        ])
        db.session.commit()


def player_to_dict(p):
    return {
        'id': p.id,
        'name': p.name,
        'timezone': p.timezone or '',
        'joined_date': p.joined_date.isoformat() if p.joined_date else None,
        'hat': bool(p.hat),
    }

def entry_to_dict(e):
    return {'id': e.id, 'player_id': e.player_id, 'date': e.date.isoformat(), 'kills': e.kills, 'tagtime': e.tagtime_hours}

def period_to_dict(p):
    return {'id': p.id, 'name': p.name, 'date_start': p.date_start.isoformat(), 'date_end': p.date_end.isoformat(), 'weight': p.weight}

def get_period_weight(d, periods):
    for p in periods:
        if p.date_start <= d <= p.date_end:
            return p.weight
    return 1.0


# Players
@app.route('/api/players', methods=['GET'])
def api_get_players():
    return jsonify([player_to_dict(p) for p in Player.query.order_by(Player.name).all()])

@app.route('/api/players', methods=['POST'])
def api_add_player():
    payload = request.get_json() or {}
    name = (payload.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name required'}), 400
    tz = (payload.get('timezone') or '').upper().strip()
    joined_str = (payload.get('joined_date') or '').strip()
    joined = date.fromisoformat(joined_str) if joined_str else None
    p = Player(name=name, timezone=tz, joined_date=joined)
    db.session.add(p)
    db.session.commit()
    return jsonify(player_to_dict(p)), 201

@app.route('/api/players/<int:pid>', methods=['GET'])
def api_get_player(pid):
    p = Player.query.get_or_404(pid)
    return jsonify(player_to_dict(p))

@app.route('/api/players/<int:pid>', methods=['PUT'])
def api_update_player(pid):
    p = Player.query.get_or_404(pid)
    payload = request.get_json() or {}
    if 'name' in payload:
        name = (payload['name'] or '').strip()
        if name: p.name = name
    if 'timezone' in payload:
        p.timezone = (payload['timezone'] or '').upper().strip()
    if 'joined_date' in payload:
        joined_str = (payload['joined_date'] or '').strip()
        p.joined_date = date.fromisoformat(joined_str) if joined_str else None
    if 'hat' in payload:
        p.hat = bool(payload['hat'])
    db.session.commit()
    return jsonify(player_to_dict(p))

@app.route('/api/players/<int:pid>', methods=['DELETE'])
def api_delete_player(pid):
    p = Player.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return '', 204


# Daily entries
@app.route('/api/entries', methods=['GET'])
def api_get_entries():
    month = request.args.get('month', '')
    try:
        year, m = map(int, month.split('-'))
        first_day = date(year, m, 1)
        last_day = date(year, m, calendar.monthrange(year, m)[1])
    except Exception:
        return jsonify({'error': 'invalid month (YYYY-MM)'}), 400

    entries = DailyEntry.query.filter(DailyEntry.date >= first_day, DailyEntry.date <= last_day).all()
    result = {}
    for e in entries:
        pid = str(e.player_id)
        if pid not in result:
            result[pid] = {}
        result[pid][e.date.isoformat()] = {'id': e.id, 'kills': e.kills, 'tagtime': e.tagtime_hours}
    return jsonify(result)

@app.route('/api/entries', methods=['POST'])
def api_upsert_entry():
    payload = request.get_json() or {}
    player_id = payload.get('player_id')
    date_str = (payload.get('date') or '').strip()
    kills = payload.get('kills')
    tagtime = payload.get('tagtime')

    if not player_id or not date_str:
        return jsonify({'error': 'player_id and date required'}), 400
    Player.query.get_or_404(player_id)
    try:
        d = date.fromisoformat(date_str)
    except Exception:
        return jsonify({'error': 'invalid date'}), 400

    kills = int(kills) if kills is not None else None
    tagtime = float(tagtime) if tagtime is not None else None

    entry = DailyEntry.query.filter_by(player_id=player_id, date=d).first()
    if entry:
        entry.kills = kills
        entry.tagtime_hours = tagtime
    else:
        entry = DailyEntry(player_id=player_id, date=d, kills=kills, tagtime_hours=tagtime)
        db.session.add(entry)
    db.session.commit()
    return jsonify(entry_to_dict(entry))


# Monthly totals
@app.route('/api/monthly', methods=['GET'])
def api_get_monthly():
    month = request.args.get('month', '')
    try:
        year, m = map(int, month.split('-'))
    except Exception:
        return jsonify({'error': 'invalid month'}), 400
    totals = MonthlyTotal.query.filter_by(year=year, month=m).all()
    return jsonify({str(t.player_id): {'kills': t.kills, 'tagtime': t.tagtime_hours} for t in totals})

@app.route('/api/monthly', methods=['POST'])
def api_upsert_monthly():
    payload = request.get_json() or {}
    player_id = payload.get('player_id')
    year = payload.get('year')
    month = payload.get('month')
    if not all([player_id, year, month]):
        return jsonify({'error': 'player_id, year, month required'}), 400
    Player.query.get_or_404(player_id)
    kills = payload.get('kills')
    tagtime = payload.get('tagtime')
    kills = int(kills) if kills is not None else None
    tagtime = float(tagtime) if tagtime is not None else None
    t = MonthlyTotal.query.filter_by(player_id=player_id, year=year, month=month).first()
    if t:
        if 'kills' in payload: t.kills = kills
        if 'tagtime' in payload: t.tagtime_hours = tagtime
    else:
        t = MonthlyTotal(player_id=player_id, year=int(year), month=int(month), kills=kills, tagtime_hours=tagtime)
        db.session.add(t)
    db.session.commit()
    return jsonify({'player_id': player_id, 'year': year, 'month': month, 'kills': t.kills, 'tagtime': t.tagtime_hours})


# Periods
@app.route('/api/periods', methods=['GET'])
def api_get_periods():
    return jsonify([period_to_dict(p) for p in Period.query.order_by(Period.date_start).all()])

@app.route('/api/periods', methods=['POST'])
def api_add_period():
    payload = request.get_json() or {}
    try:
        p = Period(
            name=(payload.get('name') or 'Period').strip(),
            date_start=date.fromisoformat(payload['date_start']),
            date_end=date.fromisoformat(payload['date_end']),
            weight=float(payload.get('weight', 1.0)),
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 400
    db.session.add(p)
    db.session.commit()
    return jsonify(period_to_dict(p)), 201

@app.route('/api/periods/<int:pid>', methods=['PUT'])
def api_update_period(pid):
    p = Period.query.get_or_404(pid)
    payload = request.get_json() or {}
    if 'name' in payload: p.name = payload['name']
    if 'date_start' in payload: p.date_start = date.fromisoformat(payload['date_start'])
    if 'date_end' in payload: p.date_end = date.fromisoformat(payload['date_end'])
    if 'weight' in payload: p.weight = float(payload['weight'])
    db.session.commit()
    return jsonify(period_to_dict(p))

@app.route('/api/periods/<int:pid>', methods=['DELETE'])
def api_delete_period(pid):
    p = Period.query.get_or_404(pid)
    db.session.delete(p)
    db.session.commit()
    return '', 204


# Leaderboard
@app.route('/api/leaderboard', methods=['GET'])
def api_leaderboard():
    month = request.args.get('month', '')
    try:
        year, m = map(int, month.split('-'))
        first_day = date(year, m, 1)
        last_day = date(year, m, calendar.monthrange(year, m)[1])
    except Exception:
        return jsonify({'error': 'invalid month'}), 400

    periods = Period.query.all()
    players = Player.query.order_by(Player.name).all()

    entries_by_player = {}
    for e in DailyEntry.query.filter(DailyEntry.date >= first_day, DailyEntry.date <= last_day).all():
        entries_by_player.setdefault(e.player_id, []).append(e)

    monthly_map = {t.player_id: t for t in MonthlyTotal.query.filter_by(year=year, month=m).all()}

    sorted_periods = sorted(periods, key=lambda p: p.date_start)

    results = []
    for player in players:
        es = entries_by_player.get(player.id, [])
        weighted_score = 0.0
        daily_total = 0
        days_active = 0
        period_kills = {p.id: 0 for p in sorted_periods}
        for e in es:
            if e.kills is not None:
                w = get_period_weight(e.date, periods)
                weighted_score += e.kills * w
                daily_total += e.kills
                days_active += 1
                for p in sorted_periods:
                    if p.date_start <= e.date <= p.date_end:
                        period_kills[p.id] += e.kills
                        break
        TAGTIME_WEIGHT = 10  # 1 hour = 10 kills equivalent
        mt = monthly_map.get(player.id)
        tagtime = mt.tagtime_hours if mt and mt.tagtime_hours else 0
        weighted_score += tagtime * TAGTIME_WEIGHT
        results.append({
            'player': player_to_dict(player),
            'weighted_score': round(weighted_score, 0),
            'daily_total': daily_total,
            'monthly_total': mt.kills if mt else None,
            'tagtime_total': round(mt.tagtime_hours, 1) if mt and mt.tagtime_hours else 0,
            'days_active': days_active,
            'period_breakdown': [
                {'id': p.id, 'name': p.name, 'kills': period_kills[p.id], 'weight': p.weight}
                for p in sorted_periods
            ],
        })

    results.sort(key=lambda x: x['weighted_score'], reverse=True)
    for i, r in enumerate(results):
        r['rank'] = i + 1
    return jsonify(results)


# Compare (chart data)
@app.route('/api/compare', methods=['GET'])
def api_compare():
    month = request.args.get('month', '')
    player_ids_str = request.args.get('players', '')
    try:
        year, m = map(int, month.split('-'))
        first_day = date(year, m, 1)
        last_day = date(year, m, calendar.monthrange(year, m)[1])
    except Exception:
        return jsonify({'error': 'invalid month'}), 400
    try:
        player_ids = [int(x) for x in player_ids_str.split(',') if x.strip()]
    except Exception:
        return jsonify({'error': 'invalid player ids'}), 400
    if not player_ids:
        return jsonify({'days': [], 'players': {}})

    entries = DailyEntry.query.filter(
        DailyEntry.player_id.in_(player_ids),
        DailyEntry.date >= first_day,
        DailyEntry.date <= last_day,
    ).all()

    by_player = {}
    for e in entries:
        by_player.setdefault(e.player_id, {})[e.date.isoformat()] = e.kills

    players_map = {p.id: p.name for p in Player.query.filter(Player.id.in_(player_ids)).all()}

    days = []
    current = first_day
    while current <= last_day:
        d_str = current.isoformat()
        point = {'date': d_str, 'day': current.day}
        for pid in player_ids:
            point[str(pid)] = by_player.get(pid, {}).get(d_str)
        days.append(point)
        current += timedelta(days=1)

    return jsonify({'days': days, 'players': {str(pid): players_map.get(pid, f'Player {pid}') for pid in player_ids}})


# Serve React
DIST_DIR = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    full = os.path.join(DIST_DIR, path)
    if path and os.path.exists(full):
        return send_from_directory(DIST_DIR, path)
    return send_from_directory(DIST_DIR, 'index.html')


if __name__ == '__main__':
    app.run(debug=True, port=5002)
