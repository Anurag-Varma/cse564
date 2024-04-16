from flask import Flask, render_template, jsonify, request
from livereload import Server
import pandas as pd
from sklearn.preprocessing import StandardScaler
import numpy as np


app = Flask(__name__)

random_sample = None
@app.route("/")
def index():
    return render_template("index.html")  

def readdata():
    df = pd.read_csv("universal_top_spotify_songs_new.csv", index_col=False)

    sample = df
    return sample

@app.route("/data")
def mainfunc():
    global random_sample, k

    if random_sample is None:
        random_sample = readdata()
        random_sample['snapshot_date'] = pd.to_datetime(random_sample['snapshot_date'])

    top_10_songs_overall = random_sample['name'].value_counts().head(10).index.tolist()
    top_10_songs_data = random_sample[random_sample['name'].isin(top_10_songs_overall)]
    song_frequency_over_time = top_10_songs_data.groupby(['snapshot_date', 'name'])['country'].count().unstack(fill_value=0)

    # Resetting the index to work with dates correctly
    song_frequency_over_time.reset_index(inplace=True)
    
    # Converting dates to string format
    song_frequency_over_time['snapshot_date'] = song_frequency_over_time['snapshot_date'].dt.strftime('%Y-%m-%d')



    song_frequency_over_time = song_frequency_over_time.to_json(orient='records')


    selected_columns = ['danceability', 'energy', 'key', 'loudness', 'mode', 
                    'speechiness', 'acousticness', 'instrumentalness', 
                    'liveness', 'valence', 'tempo']

    pcp_data = random_sample[selected_columns]

    pcp_data_json = pcp_data.to_json(orient='records')


    return jsonify({
        "pcp_data": pcp_data_json,
        "song_frequency_over_time": song_frequency_over_time
    })
    
if __name__ == "__main__":
    app.run(debug=True)
    index()