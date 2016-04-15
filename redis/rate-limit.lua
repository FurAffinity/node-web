local actions_key = KEYS[1]
local duration = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local cutoff = now - duration
local t

repeat
	t = tonumber(redis.call('lpop', actions_key))
until t == nil or t >= cutoff

local count

if t == nil then
	count = 0
else
	count = redis.call('llen', actions_key) + 1
	redis.call('lpush', actions_key, t)
end

if count < limit then
	redis.call('rpush', actions_key, now)
	redis.call('expire', actions_key, duration)
	return true
else
	return false
end
