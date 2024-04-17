from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np

app = Flask(__name__)

# Global variable to hold the data sample
random_sample = None
start_date = None
end_date = None
fixed_start_date = None
fixed_end_date = None

@app.route("/")
def index():
    return render_template("index.html")

def readdata():
    global start_date, end_date, fixed_end_date, fixed_start_date
    df = pd.read_csv("filtered_data.csv", index_col=False)
    df['snapshot_date'] = pd.to_datetime(df['snapshot_date'])
    start_date = df['snapshot_date'].min()
    end_date = df['snapshot_date'].max()
    fixed_start_date = start_date
    fixed_end_date = end_date
    return df.sample(n=10000)

@app.route("/data")
def mainfunc():
    global random_sample, start_date, end_date, fixed_start_date, fixed_end_date

    if random_sample is None:
        random_sample = readdata()

    filtered_sample = random_sample[(random_sample['snapshot_date'] >= start_date) & (random_sample['snapshot_date'] <= end_date)]

    # Extract top 10 songs based on frequency and prepare data to show their frequency over time
    top_10_songs_overall = filtered_sample['name'].value_counts().head(10).index.tolist()
    top_10_songs_data = filtered_sample[filtered_sample['name'].isin(top_10_songs_overall)]

    # Group by week and by song name, then count occurrences
    song_frequency_over_time = top_10_songs_data.groupby([pd.Grouper(key='snapshot_date', freq='W'), 'name'])['country'].count().unstack(fill_value=0)
    song_frequency_over_time.reset_index(inplace=True)
    song_frequency_over_time['snapshot_date'] = song_frequency_over_time['snapshot_date'].dt.strftime('%Y-%m-%d')
    song_frequency_over_time_json = song_frequency_over_time.to_json(orient='records')

    # Extract selected features for parallel coordinates plot
    selected_columns = ['danceability', 'energy', 'key', 'loudness',
                        'speechiness', 'acousticness', 
                        'liveness', 'valence', 'tempo']
    pcp_data = filtered_sample[selected_columns]
    np.random.seed(42)
    pcp_data = pcp_data.sample(n=100)
    pcp_data_json = pcp_data.to_json(orient='records')

    # Return JSON data for the client side
    return jsonify({
        "pcp_data": pcp_data_json,
        "song_frequency_over_time": song_frequency_over_time_json,
        "fixed_start_date":fixed_start_date,
        "fixed_end_date": fixed_end_date,
    })

@app.route('/update-date-range', methods=['POST'])
def update_date_range():
    global random_sample, start_date, end_date

    if request.is_json:
        data = request.get_json()
        start_date = pd.to_datetime(data.get('start_date'))
        end_date = pd.to_datetime(data.get('end_date'))

        return jsonify({"status": "success", "message": "Date range updated successfully."}), 200
    else:
        return jsonify({"error": "Request must be JSON"}), 400

if __name__ == "__main__":
    app.run(debug=True)
